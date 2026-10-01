import { and, asc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { Database } from "@/db";
import {
  carts,
  cartItems,
  products,
  orders,
  orderItems,
  emailOutbox,
  deliveryEvents,
} from "@/db/schema";
import type { ShippingAddress, Receipt } from "./types";
import { deliveryFee, effectivePrice } from "./utils";
import { AppError } from "./errors";
import { assertPaymentMatches, type VerifiedPayment } from "./paystack";
import { trackingFor } from "./tracking-service";

export async function createPendingOrder(
  db: Database,
  input: {
    cartId: string;
    userId: string | null;
    idempotencyKey: string;
    accessHash: string;
    shipping: ShippingAddress;
    expectedTotalNaira: number;
  },
) {
  return db.transaction(async (tx) => {
    await tx
      .select()
      .from(carts)
      .where(eq(carts.id, input.cartId))
      .for("update");
    const [previous] = await tx
      .select()
      .from(orders)
      .where(eq(orders.idempotencyKey, input.idempotencyKey));
    if (previous) {
      if (previous.cartId !== input.cartId)
        throw new AppError("Invalid checkout request.", 403);
      if (["expired", "failed"].includes(previous.status))
        throw new AppError(
          "This checkout expired. Refresh the page to start again.",
          409,
        );
      if (["paid", "fulfillment_review"].includes(previous.status)) {
        await tx.update(orders).set({ accessHash: input.accessHash }).where(eq(orders.id, previous.id));
        return { ...previous, accessHash: input.accessHash };
      }
    }
    const lines = await tx
      .select()
      .from(cartItems)
      .where(eq(cartItems.cartId, input.cartId));
    if (!lines.length)
      throw new AppError("Your bag is empty. Add something you love first.");
    const [foundActive] = await tx
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.cartId, input.cartId),
          eq(orders.status, "pending"),
          eq(orders.reservationActive, true),
          gt(orders.expiresAt, new Date()),
        ),
      )
      .limit(1);
    const active = previous || foundActive;
    if (active) {
      const heldItems = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, active.id));
      const sameItems =
        lines.length === heldItems.length &&
        lines.every((line) =>
          heldItems.some(
            (item) =>
              item.productId === line.productId &&
              item.quantity === line.quantity,
          ),
        );
      if (
        !sameItems ||
        active.totalAmountNaira !== input.expectedTotalNaira ||
        !(["fullName", "email", "phone", "address", "city", "state", "notes"] as const).every(key => (active.shippingAddress[key] || "") === (input.shipping[key] || ""))
      )
        throw new AppError(
          "A checkout is already reserved for this bag. Complete it, or try again when its 30-minute reservation ends.",
          409,
        );
      await tx
        .update(orders)
        .set({ accessHash: input.accessHash })
        .where(eq(orders.id, active.id));
      return { ...active, accessHash: input.accessHash };
    }
    const inventory = await tx
      .select()
      .from(products)
      .where(
        inArray(
          products.id,
          lines.map((i) => i.productId),
        ),
      )
      .orderBy(asc(products.id))
      .for("update");
    const map = new Map(inventory.map((p) => [p.id, p]));
    const snapshots = lines.map((line) => {
      const p = map.get(line.productId);
      if (!p || p.stock - p.reserved < line.quantity)
        throw new AppError(
          `${p?.title || "An item"} is no longer available in that quantity. Please update your bag.`,
          409,
        );
      const price = effectivePrice(p);
      return {
        productId: p.id,
        title: p.title,
        imageUrl: p.imageUrl,
        quantity: line.quantity,
        priceAtPurchase: price,
        originalPriceNaira:
          p.originalPriceNaira && p.originalPriceNaira > price
            ? p.originalPriceNaira
            : null,
      };
    });
    const subtotal = snapshots.reduce(
      (sum, i) => sum + i.priceAtPurchase * i.quantity,
      0,
    );
    const shipping = deliveryFee(subtotal, input.shipping.state);
    if (subtotal + shipping !== input.expectedTotalNaira)
      throw new AppError(
        "Your prices or delivery fee changed. Refresh your bag before paying.",
        409,
      );
    if (subtotal + shipping > 20000000)
      throw new AppError("Please contact the store for high-value orders.");
    const [order] = await tx
      .insert(orders)
      .values({
        cartId: input.cartId,
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
        accessHash: input.accessHash,
        email: input.shipping.email,
        shippingAddress: input.shipping,
        paystackReference: `KORA_${randomBytes(12).toString("hex")}`,
        subtotalNaira: subtotal,
        shippingNaira: shipping,
        totalAmountNaira: subtotal + shipping,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      })
      .returning();
    await tx
      .insert(orderItems)
      .values(snapshots.map((item) => ({ ...item, orderId: order.id })));
    for (const line of lines)
      await tx
        .update(products)
        .set({ reserved: sql`${products.reserved} + ${line.quantity}` })
        .where(eq(products.id, line.productId));
    return order;
  });
}

export async function finalizePayment(db: Database, payment: VerifiedPayment) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.paystackReference, payment.reference))
      .for("update");
    if (!order) throw new AppError("Order not found.", 404);
    assertPaymentMatches(payment, {
      reference: order.paystackReference,
      totalNaira: order.totalAmountNaira,
      email: order.email,
    });
    if (order.status === "paid" || order.status === "fulfillment_review")
      return order;
    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    const [sourceCart] = await tx
      .select()
      .from(carts)
      .where(eq(carts.id, order.cartId));
    const destinationId = sourceCart.mergedInto || sourceCart.id;
    const [lockedCart] = await tx
      .select()
      .from(carts)
      .where(eq(carts.id, destinationId))
      .for("update");
    // If a guest bag moved during this transaction, retry rather than lock carts in reverse order.
    if (lockedCart.mergedInto)
      throw new AppError(
        "Your bag just synced. Please check your payment again.",
        503,
      );
    const inventory = await tx
      .select()
      .from(products)
      .where(
        inArray(
          products.id,
          items.map((i) => i.productId),
        ),
      )
      .orderBy(asc(products.id))
      .for("update");
    const map = new Map(inventory.map((p) => [p.id, p]));
    const canFulfill = items.every((item) => {
      const p = map.get(item.productId)!;
      return order.reservationActive
        ? p.stock >= item.quantity && p.reserved >= item.quantity
        : p.stock - p.reserved >= item.quantity;
    });
    for (const item of items) {
      if (order.reservationActive)
        await tx
          .update(products)
          .set({
            reserved: sql`${products.reserved} - ${item.quantity}`,
            ...(canFulfill
              ? { stock: sql`${products.stock} - ${item.quantity}` }
              : {}),
          })
          .where(eq(products.id, item.productId));
      else if (canFulfill)
        await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${item.quantity}` })
          .where(eq(products.id, item.productId));
      // Preserve items added after payment was started; remove the purchased quantities.
      const [line] = await tx
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.cartId, destinationId),
            eq(cartItems.productId, item.productId),
          ),
        );
      if (line) {
        if (line.quantity <= item.quantity)
          await tx
            .delete(cartItems)
            .where(
              and(
                eq(cartItems.cartId, destinationId),
                eq(cartItems.productId, item.productId),
              ),
            );
        else
          await tx
            .update(cartItems)
            .set({ quantity: line.quantity - item.quantity })
            .where(
              and(
                eq(cartItems.cartId, destinationId),
                eq(cartItems.productId, item.productId),
              ),
            );
      }
    }
    await tx
      .update(carts)
      .set({ revision: sql`${carts.revision} + 1`, updatedAt: new Date() })
      .where(eq(carts.id, destinationId));
    const [paid] = await tx
      .update(orders)
      .set({
        status: canFulfill ? "paid" : "fulfillment_review",
        reservationActive: false,
        paidAt: new Date(),
        deliveryStatus: canFulfill ? "processing" : "payment_review",
        deliveryUpdatedAt: new Date(),
      })
      .where(eq(orders.id, order.id))
      .returning();
    await tx.insert(deliveryEvents).values({
      orderId: order.id,
      status: canFulfill ? "processing" : "payment_review",
      message: canFulfill ? "Payment confirmed. Your order is being prepared." : "Payment received. The store is reviewing availability.",
      idempotencyKey: "payment:" + order.id,
    }).onConflictDoNothing();
    await tx
      .insert(emailOutbox)
      .values({ orderId: order.id })
      .onConflictDoNothing();
    return paid;
  });
}

export async function releaseExpiredOrders(db: Database) {
  return db.transaction(async (tx) => {
    const expired = await tx
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.status, "pending"),
          eq(orders.reservationActive, true),
          lt(orders.expiresAt, new Date()),
        ),
      )
      .orderBy(asc(orders.id))
      .limit(30)
      .for("update", { skipLocked: true });
    for (const order of expired) {
      const items = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))
        .orderBy(asc(orderItems.productId));
      for (const item of items)
        await tx
          .update(products)
          .set({ reserved: sql`${products.reserved} - ${item.quantity}` })
          .where(eq(products.id, item.productId));
      await tx
        .update(orders)
        .set({ status: "expired", reservationActive: false })
        .where(eq(orders.id, order.id));
    }
    return expired.length;
  });
}
export async function receiptFor(
  db: Database,
  orderId: string,
): Promise<Receipt> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new AppError("Order not found.", 404);
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  return {
    id: order.id,
    reference: order.paystackReference,
    status: order.status,
    subtotalNaira: order.subtotalNaira,
    shippingNaira: order.shippingNaira,
    totalNaira: order.totalAmountNaira,
    shipping: order.shippingAddress,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    tracking: await trackingFor(db, order.id),
    items: items.map((item) => ({
      productId: item.productId,
      title: item.title,
      imageUrl: item.imageUrl,
      quantity: item.quantity,
      priceNaira: item.priceAtPurchase,
      originalPriceNaira: item.originalPriceNaira,
    })),
  };
}
