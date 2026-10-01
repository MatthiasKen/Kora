import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHmac, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import type { Database } from "../src/db";
import type { ShippingAddress, Receipt } from "../src/lib/types";
import {
  createPendingOrder,
  finalizePayment,
  receiptFor,
  releaseExpiredOrders,
} from "../src/lib/order-service";
import { assertCartOwner, ensureAccountCart, readCart, startGuestCartAfterLogout } from "../src/lib/cart-service";
import { cartStorageKey, validCartLines } from "../src/lib/cart-storage";
import { mergeCartLines, deliveryFee, effectivePrice } from "../src/lib/utils";
import { validPaystackSignature } from "../src/lib/security";
import {
  assertPaymentMatches,
  type VerifiedPayment,
} from "../src/lib/paystack";
import { orderEmail } from "../src/lib/email-template";
import { shippingSchema } from "../src/lib/validation";

const shipping: ShippingAddress = {
  fullName: "Test Customer",
  email: "test@example.com",
  phone: "08012345678",
  address: "12 Sample Street",
  city: "Ikeja",
  state: "Lagos",
};
describe(
  "Payment, stock and cart integration against embedded PostgreSQL",
  { concurrency: false },
  () => {
    let pg: PGlite;
    let db: Database;
    before(async () => {
      pg = new PGlite();
      const actual = drizzle(pg, { schema });
      db = actual as unknown as Database;
      for (const file of readdirSync("drizzle")
        .filter((f) => f.endsWith(".sql"))
        .sort())
        await pg.exec(readFileSync(`drizzle/${file}`, "utf8"));
    });
    after(async () => {
      await pg.close();
    });
    async function fixture(stock = 3, qty = 2) {
      const id = randomUUID();
      await db
        .insert(schema.products)
        .values({
          id,
          slug: id,
          title: "Sample Item",
          description: "Test item",
          category: "Electronics",
          priceNaira: 10000,
          originalPriceNaira: 15000,
          stock,
          imageUrl: "/sample.webp",
        });
      const [cart] = await db
        .insert(schema.carts)
        .values({ sessionHash: randomUUID() })
        .returning();
      await db
        .insert(schema.cartItems)
        .values({ cartId: cart.id, productId: id, quantity: qty });
      return {
        id,
        cart,
        input: {
          cartId: cart.id,
          userId: null,
          idempotencyKey: randomUUID(),
          accessHash: randomUUID(),
          shipping,
          expectedTotalNaira: qty * 10000 + 2500,
        },
      };
    }
    const payment = (reference: string, total: number): VerifiedPayment => ({
      reference,
      status: "success",
      amount: total * 100,
      currency: "NGN",
      customer: { email: shipping.email },
    });
    it("rejects client price manipulation before stock is reserved", async () => {
      const f = await fixture();
      await assert.rejects(
        createPendingOrder(db, { ...f.input, expectedTotalNaira: 1 }),
        /prices or delivery fee changed/,
      );
      const [p] = await db
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, f.id));
      assert.equal(p.reserved, 0);
    });
    it("resumes one pending checkout across retry keys and rejects changed details", async () => {
      const f = await fixture();
      const order = await createPendingOrder(db, f.input);
      const resumed = await createPendingOrder(db, { ...f.input, idempotencyKey: randomUUID() });
      assert.equal(resumed.id, order.id);
      const [p] = await db.select().from(schema.products).where(eq(schema.products.id, f.id));
      assert.equal(p.reserved, 2);
      await assert.rejects(createPendingOrder(db, { ...f.input, shipping: { ...shipping, address: "99 A Different Street" } }), /already reserved/);
    });
    it("reserves once, prevents overselling, rejects mismatched payment and finalizes only once", async () => {
      const f = await fixture();
      const order = await createPendingOrder(db, f.input);
      const repeat = await createPendingOrder(db, f.input);
      assert.equal(repeat.id, order.id);
      const [held] = await db
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, f.id));
      assert.equal(held.stock, 3);
      assert.equal(held.reserved, 2);
      const [secondCart] = await db
        .insert(schema.carts)
        .values({ sessionHash: randomUUID() })
        .returning();
      await db
        .insert(schema.cartItems)
        .values({ cartId: secondCart.id, productId: f.id, quantity: 2 });
      await assert.rejects(
        createPendingOrder(db, {
          ...f.input,
          cartId: secondCart.id,
          idempotencyKey: randomUUID(),
        }),
        /no longer available/,
      );
      await assert.rejects(
        finalizePayment(db, {
          ...payment(order.paystackReference, order.totalAmountNaira),
          amount: 100,
        }),
        /could not be matched/,
      );
      const [pending] = await db
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.id, order.id));
      assert.equal(pending.status, "pending");
      const paid = await finalizePayment(
        db,
        payment(order.paystackReference, order.totalAmountNaira),
      );
      assert.equal(paid.status, "paid");
      await finalizePayment(
        db,
        payment(order.paystackReference, order.totalAmountNaira),
      );
      const [p] = await db
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, f.id));
      assert.equal(p.stock, 1);
      assert.equal(p.reserved, 0);
      assert.equal(
        (
          await db
            .select()
            .from(schema.cartItems)
            .where(eq(schema.cartItems.cartId, f.cart.id))
        ).length,
        0,
      );
      assert.equal(
        (
          await db
            .select()
            .from(schema.emailOutbox)
            .where(eq(schema.emailOutbox.orderId, order.id))
        ).length,
        1,
      );
      const receipt = await receiptFor(db, order.id);
      assert.equal(receipt.items[0].originalPriceNaira, 15000);
      assert.equal(receipt.totalNaira, 22500);
    });
    it("preserves extra bag quantities added after checkout began", async () => {
      const f = await fixture(10, 2);
      const order = await createPendingOrder(db, f.input);
      await db
        .update(schema.cartItems)
        .set({ quantity: 4 })
        .where(eq(schema.cartItems.cartId, f.cart.id));
      await finalizePayment(
        db,
        payment(order.paystackReference, order.totalAmountNaira),
      );
      const [line] = await db
        .select()
        .from(schema.cartItems)
        .where(eq(schema.cartItems.cartId, f.cart.id));
      assert.equal(line.quantity, 2);
    });
    it("releases expired reservations once and records late paid orders for review when unavailable", async () => {
      const f = await fixture(2, 2);
      const order = await createPendingOrder(db, f.input);
      await db
        .update(schema.orders)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(schema.orders.id, order.id));
      assert.equal(await releaseExpiredOrders(db), 1);
      assert.equal(await releaseExpiredOrders(db), 0);
      await db
        .update(schema.products)
        .set({ stock: 0 })
        .where(eq(schema.products.id, f.id));
      const late = await finalizePayment(
        db,
        payment(order.paystackReference, order.totalAmountNaira),
      );
      assert.equal(late.status, "fulfillment_review");
      const [p] = await db
        .select()
        .from(schema.products)
        .where(eq(schema.products.id, f.id));
      assert.equal(p.stock, 0);
      assert.equal(p.reserved, 0);
    });
    it("merges guest selections once, hides account items on logout, and restores them only to their owner", async () => {
      const f = await fixture(30, 2);
      const [user] = await db
        .insert(schema.users)
        .values({
          googleId: randomUUID(),
          email: `${randomUUID()}@example.com`,
          name: "Demo User",
        })
        .returning();
      const merged = await ensureAccountCart(db, user.id, f.cart.sessionHash);
      await ensureAccountCart(db, user.id, f.cart.sessionHash);
      const [initial] = await db
        .select()
        .from(schema.cartItems)
        .where(eq(schema.cartItems.cartId, merged.id));
      assert.equal(initial.quantity, 2);
      const newHash = randomUUID();
      assert.deepEqual(await startGuestCartAfterLogout(db, merged.id, user.id, newHash), { items: [], revision: 0 });
      const [signedOutGuest] = await db.select().from(schema.carts).where(eq(schema.carts.sessionHash, newHash));
      assert.deepEqual((await readCart(db, signedOutGuest.id)).items, []);
      assert.equal((await readCart(db, merged.id)).items[0].quantity, 2);
      await ensureAccountCart(db, user.id, newHash);
      const [afterLogin] = await db
        .select()
        .from(schema.cartItems)
        .where(eq(schema.cartItems.cartId, merged.id));
      assert.equal(afterLogin.quantity, 2);
      const thirdHash = randomUUID();
      await startGuestCartAfterLogout(db, merged.id, user.id, thirdHash);
      const [guest] = await db
        .select()
        .from(schema.carts)
        .where(eq(schema.carts.sessionHash, thirdHash));
      await db
        .insert(schema.cartItems)
        .values({ cartId: guest.id, productId: f.id, quantity: 1 });
      await ensureAccountCart(db, user.id, thirdHash);
      await ensureAccountCart(db, user.id, thirdHash);
      const [added] = await db
        .select()
        .from(schema.cartItems)
        .where(eq(schema.cartItems.cartId, merged.id));
      assert.equal(added.quantity, 3);
      const [other] = await db.insert(schema.users).values({ googleId: randomUUID(), email: `${randomUUID()}@example.com`, name: "Another customer" }).returning();
      const fourthHash = randomUUID();
      await startGuestCartAfterLogout(db, merged.id, user.id, fourthHash);
      const otherCart = await ensureAccountCart(db, other.id, fourthHash);
      assert.deepEqual((await readCart(db, otherCart.id)).items, []);
      assert.equal((await readCart(db, merged.id)).items[0].quantity, 3);
      await assert.rejects(startGuestCartAfterLogout(db, merged.id, other.id, randomUUID()), /another account/);
    });
    it("does not transfer a legacy account snapshot to a different user's cart", async () => {
      const f = await fixture(30, 2);
      const [owner] = await db.insert(schema.users).values({ googleId: randomUUID(), email: `${randomUUID()}@example.com`, name: "Original owner" }).returning();
      const [other] = await db.insert(schema.users).values({ googleId: randomUUID(), email: `${randomUUID()}@example.com`, name: "Other customer" }).returning();
      await db.update(schema.carts).set({ snapshotUserId: owner.id, snapshot: [{ productId: f.id, quantity: 2 }] }).where(eq(schema.carts.id, f.cart.id));
      const cart = await ensureAccountCart(db, other.id, f.cart.sessionHash);
      assert.deepEqual((await readCart(db, cart.id)).items, []);
    });
  },
);
describe("Security and pricing rules", () => {
  it("verifies the exact raw Paystack body and rejects tampering", () => {
    const raw = '{"event":"charge.success"}';
    const secret = "test-secret";
    const signature = createHmac("sha512", secret).update(raw).digest("hex");
    assert.equal(validPaystackSignature(raw, signature, secret), true);
    assert.equal(validPaystackSignature(raw + " ", signature, secret), false);
    assert.equal(validPaystackSignature(raw, null, secret), false);
    assert.equal(validPaystackSignature(raw, "invalid", secret), false);
  });
  it("requires successful NGN payments with matching amount, reference and email", () => {
    const p: VerifiedPayment = {
      reference: "sample",
      status: "success",
      amount: 1000000,
      currency: "NGN",
      customer: { email: "TEST@example.com" },
    };
    const expected = {
      reference: "sample",
      totalNaira: 10000,
      email: "test@example.com",
    };
    assert.doesNotThrow(() => assertPaymentMatches(p, expected));
    for (const changed of [
      { ...p, currency: "USD" },
      { ...p, reference: "different" },
      { ...p, amount: 1 },
      { ...p, status: "pending" },
      { ...p, customer: { email: "other@example.com" } },
    ])
      assert.throws(() => assertPaymentMatches(changed, expected));
  });
  it("uses the original price after a daily deal ends", () => {
    const p = {
      priceNaira: 15000,
      originalPriceNaira: 20000,
      isDailyDeal: true,
      dealEndsAt: "2026-01-01T00:00:00Z",
    };
    assert.equal(effectivePrice(p, new Date("2026-01-02").getTime()), 20000);
    assert.equal(effectivePrice(p, new Date("2025-12-31").getTime()), 15000);
  });
  it("keeps legacy baseline merging idempotent during upgrades", () => {
    assert.deepEqual(
      mergeCartLines(
        [{ productId: "a", quantity: 3 }],
        [],
        [{ productId: "a", quantity: 2 }],
      ),
      [{ productId: "a", quantity: 1 }],
    );
    assert.deepEqual(
      mergeCartLines(
        [{ productId: "a", quantity: 2 }],
        [{ productId: "a", quantity: 2 }],
        [{ productId: "a", quantity: 2 }],
      ),
      [{ productId: "a", quantity: 2 }],
    );
  });
  it("separates guest, account and demo/live storage and rejects invalid cached lines", () => {
    assert.notEqual(cartStorageKey(true), cartStorageKey(true, "owner@example.com"));
    assert.notEqual(cartStorageKey(true, "owner@example.com"), cartStorageKey(true, "other@example.com"));
    assert.notEqual(cartStorageKey(true), cartStorageKey(false));
    assert.deepEqual(validCartLines([{ productId: "a", quantity: 2 }, { productId: "missing", quantity: 1 }, { productId: "a", quantity: -3 }, null, { productId: "a", quantity: 1.5 }, { productId: "a", quantity: 3 }], new Set(["a"])), [{ productId: "a", quantity: 5 }]);
  });
  it("rejects stale cart writes after signing out or switching accounts", () => {
    assert.doesNotThrow(() => assertCartOwner(null, null));
    assert.doesNotThrow(() => assertCartOwner("owner", "owner"));
    assert.throws(() => assertCartOwner("owner", null), /sign-in changed/);
    assert.throws(() => assertCartOwner(null, "owner"), /sign-in changed/);
    assert.throws(() => assertCartOwner("owner", "other"), /sign-in changed/);
  });
  it("formats delivery rules and validates Nigerian delivery details", () => {
    assert.equal(deliveryFee(100000, "Kano"), 0);
    assert.equal(deliveryFee(50000, "Lagos"), 2500);
    assert.equal(deliveryFee(50000, "Ogun"), 3500);
    assert.equal(deliveryFee(50000, "Kano"), 5000);
    assert.equal(shippingSchema.safeParse(shipping).success, true);
    assert.equal(
      shippingSchema.safeParse({ ...shipping, phone: "123" }).success,
      false,
    );
    assert.equal(
      shippingSchema.safeParse({ ...shipping, state: "Not a state" }).success,
      false,
    );
  });
  it("escapes user-provided fields in the itemized confirmation email", () => {
    const receipt: Receipt = {
      id: "order",
      reference: "ref",
      status: "paid",
      items: [
        {
          productId: "p",
          title: "<img src=x onerror=alert(1)>",
          imageUrl: "/p",
          quantity: 2,
          priceNaira: 10000,
          originalPriceNaira: 15000,
        },
      ],
      shipping: {
        ...shipping,
        fullName: "<script>evil</script>",
        notes: "<b>note</b>",
      },
      subtotalNaira: 20000,
      shippingNaira: 2500,
      totalNaira: 22500,
      createdAt: "2026-01-01",
      paidAt: "2026-01-01",
    };
    const email = orderEmail(receipt);
    assert.ok(!email.html.includes("<script>"));
    assert.ok(!email.html.includes("<img src=x"));
    assert.ok(email.html.includes("&lt;script&gt;"));
    assert.ok(email.html.includes("₦22,500"));
    assert.ok(email.html.includes("<s"));
  });
});
