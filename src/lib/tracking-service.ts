import { desc, eq } from "drizzle-orm";
import type { Database } from "@/db";
import { deliveryEvents, orders } from "@/db/schema";
import type { DeliveryStatus, OrderTracking } from "./types";
import { allowedDeliveryTransition, DELIVERY_STEPS } from "./delivery";
import { AppError } from "./errors";
import type { deliveryUpdateSchema } from "./validation";
import type { z } from "zod";

export async function trackingFor(db: Database, orderId: string): Promise<OrderTracking> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new AppError("Order not found.", 404);
  const rows = await db.select({ id: deliveryEvents.id, status: deliveryEvents.status, message: deliveryEvents.message, location: deliveryEvents.location, createdAt: deliveryEvents.createdAt })
    .from(deliveryEvents).where(eq(deliveryEvents.orderId, orderId)).orderBy(desc(deliveryEvents.createdAt), desc(deliveryEvents.id)).limit(100);
  const events = rows.reverse().map(row => ({ ...row, status: row.status as DeliveryStatus, createdAt: row.createdAt.toISOString() }));
  const status = order.deliveryStatus === "awaiting_payment" && order.paidAt
    ? order.status === "paid" ? "processing" : "payment_review" : order.deliveryStatus as DeliveryStatus;
  if (order.paidAt && !events.some(event => event.status === "processing" || event.status === "payment_review"))
    events.unshift({ id: order.id + "-payment", status: order.status === "paid" ? "processing" : "payment_review",
      message: order.status === "paid" ? "Payment confirmed. Your order is being prepared." : "Payment received. The store is reviewing availability.",
      location: null, createdAt: order.paidAt.toISOString() });
  return { orderId, reference: order.paystackReference, paymentStatus: order.status, status,
    carrier: order.carrier, trackingNumber: order.trackingNumber, trackingUrl: order.trackingUrl,
    estimatedDeliveryAt: order.estimatedDeliveryAt?.toISOString() ?? null, deliveredAt: order.deliveredAt?.toISOString() ?? null,
    updatedAt: (order.deliveryUpdatedAt || order.paidAt || order.createdAt).toISOString(),
    version: order.deliveryVersion, destination: { city: order.shippingAddress.city, state: order.shippingAddress.state }, events };
}
export async function updateDelivery(db: Database, orderId: string, actorEmail: string, input: z.infer<typeof deliveryUpdateSchema>) {
  await db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw new AppError("Order not found.", 404);
    if (order.status !== "paid" || !order.paidAt) throw new AppError("Confirm payment and resolve any order review before updating delivery.", 409);
    const [duplicate] = await tx.select().from(deliveryEvents).where(eq(deliveryEvents.idempotencyKey, input.idempotencyKey));
    if (duplicate) {
      if (duplicate.orderId !== orderId) throw new AppError("Invalid delivery update.", 409);
      return;
    }
    if (order.deliveryVersion !== input.version) throw new AppError("Another update was saved. Refresh this order before making changes.", 409);
    const current = order.deliveryStatus === "awaiting_payment" ? "processing" : order.deliveryStatus as DeliveryStatus;
    const history = await tx.select({ status: deliveryEvents.status }).from(deliveryEvents)
      .where(eq(deliveryEvents.orderId, orderId)).orderBy(desc(deliveryEvents.createdAt));
    const previous = DELIVERY_STEPS[Math.max(0, ...history.map(event => DELIVERY_STEPS.indexOf(event.status as DeliveryStatus)))];
    if (!allowedDeliveryTransition(current, input.status, previous))
      throw new AppError("Move to the next delivery step. Completed steps cannot be reversed.", 409);
    const now = new Date();
    await tx.update(orders).set({
      deliveryStatus: input.status, deliveryVersion: order.deliveryVersion + 1, deliveryUpdatedAt: now,
      carrier: input.carrier || null, trackingNumber: input.trackingNumber || null, trackingUrl: input.trackingUrl || null,
      estimatedDeliveryAt: input.estimatedDeliveryAt ? new Date(input.estimatedDeliveryAt + "T12:00:00Z") : null,
      deliveredAt: input.status === "delivered" ? order.deliveredAt || now : null,
    }).where(eq(orders.id, orderId));
    await tx.insert(deliveryEvents).values({
      orderId, status: input.status, message: input.message, location: input.location || null,
      actorEmail, idempotencyKey: input.idempotencyKey, createdAt: now,
    });
  });
  return trackingFor(db, orderId);
}
