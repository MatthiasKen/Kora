import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import type { Database } from "../src/db";
import { createPendingOrder, finalizePayment, receiptFor } from "../src/lib/order-service";
import { getReviewPage, saveProductReview } from "../src/lib/review-service";
import { trackingFor, updateDelivery } from "../src/lib/tracking-service";
import { trackingAccessToken, validTrackingAccess } from "../src/lib/tracking-access";
import { ensureAccountCart, readCart, replaceCart } from "../src/lib/cart-service";
import { rebaseCartLines } from "../src/lib/cart-storage";
import { deliveryUpdateSchema, reviewSchema } from "../src/lib/validation";
import { orderEmail } from "../src/lib/email-template";
import { MAX_CATALOG_PRICE } from "../src/lib/catalog-tools";

describe("Account carts, verified reviews and delivery persistence", { concurrency: false }, () => {
  let pg: PGlite;
  let db: Database;
  before(async () => {
    pg = new PGlite();
    db = drizzle(pg, { schema }) as unknown as Database;
    for (const file of readdirSync("drizzle").filter(file => file.endsWith(".sql")).sort()) await pg.exec(readFileSync("drizzle/" + file, "utf8"));
  });
  after(async () => { await pg.close(); });
  async function customer() {
    const [user] = await db.insert(schema.users).values({ googleId: randomUUID(), email: randomUUID() + "@example.test", name: "Matthias Customer" }).returning();
    return user;
  }
  async function fixture() {
    const user = await customer();
    const productId = randomUUID();
    await db.insert(schema.products).values({ id: productId, slug: productId, title: "Reviewed item", description: "An actual service test item.", category: "Electronics", priceNaira: 10000, originalPriceNaira: 15000, stock: 20, imageUrl: "/item.webp" });
    const [cart] = await db.insert(schema.carts).values({ sessionHash: randomUUID(), userId: user.id }).returning();
    await db.insert(schema.cartItems).values({ cartId: cart.id, productId, quantity: 1 });
    const order = await createPendingOrder(db, { cartId: cart.id, userId: user.id, idempotencyKey: randomUUID(), accessHash: randomUUID(), expectedTotalNaira: 12500,
      shipping: { fullName: user.name, email: user.email, address: "12 Private Address", phone: "08012345678", city: "Ikeja", state: "Lagos" } });
    const pay = () => finalizePayment(db, { reference: order.paystackReference, status: "success", amount: order.totalAmountNaira * 100, currency: "NGN", customer: { email: user.email } });
    return { user, productId, cart, order, pay };
  }
  function delivery(status: "packed" | "shipped" | "out_for_delivery" | "delivered" | "exception", version: number) {
    return deliveryUpdateSchema.parse({ status, version, idempotencyKey: randomUUID(), message: "The actual delivery milestone was recorded.", carrier: "Store delivery team", location: "Lagos" });
  }
  it("returns one account cart for separate device sessions and rejects stale writes", async () => {
    const f = await fixture();
    const firstDevice = await ensureAccountCart(db, f.user.id, randomUUID());
    const secondDevice = await ensureAccountCart(db, f.user.id, randomUUID());
    assert.equal(firstDevice.id, secondDevice.id);
    assert.equal(firstDevice.id, f.cart.id);
    const before = await readCart(db, firstDevice.id);
    await replaceCart(db, firstDevice.id, [{ productId: f.productId, quantity: 2 }], before.revision);
    await assert.rejects(replaceCart(db, secondDevice.id, [{ productId: f.productId, quantity: 3 }], before.revision), error => {
      assert.equal((error as { status: number }).status, 409);
      assert.deepEqual((error as { fields: object }).fields, { revision: "conflict" });
      return true;
    });
    const remote = await readCart(db, secondDevice.id);
    const merged = rebaseCartLines(before.items, [{ productId: f.productId, quantity: 3 }], remote.items);
    await replaceCart(db, secondDevice.id, merged, remote.revision);
    assert.equal((await readCart(db, firstDevice.id)).items[0].quantity, 4);
    const other = await customer();
    assert.deepEqual((await readCart(db, (await ensureAccountCart(db, other.id, randomUUID())).id)).items, []);
  });
  it("permits reviews only for the customer with a verified paid purchase, then edits once", async () => {
    const f = await fixture();
    const input = reviewSchema.parse({ rating: 5, title: "A useful purchase", body: "Comfortable to use and exactly what I needed." });
    await assert.rejects(saveProductReview(db, f.productId, f.user.id, input), /confirmed purchase/);
    assert.equal((await getReviewPage(db, f.productId, f.user.id)).eligible, false);
    await f.pay();
    const other = await customer();
    await assert.rejects(saveProductReview(db, f.productId, other.id, input), /confirmed purchase/);
    await saveProductReview(db, f.productId, f.user.id, input);
    let page = await getReviewPage(db, f.productId, f.user.id);
    assert.equal(page.summary.average, 5);
    assert.equal(page.summary.count, 1);
    assert.equal(page.eligible, true);
    assert.equal(page.reviews[0].verifiedPurchase, true);
    assert.equal(page.reviews[0].author, "Matthias C.");
    assert.equal(JSON.stringify(page.reviews).includes(f.user.email), false);
    assert.equal("userId" in page.reviews[0], false);
    assert.equal("orderId" in page.reviews[0], false);
    await saveProductReview(db, f.productId, f.user.id, { ...input, rating: 4, title: "Updated after using it" });
    page = await getReviewPage(db, f.productId);
    assert.equal(page.summary.count, 1);
    assert.equal(page.summary.average, 4);
    assert.equal(page.summary.distribution[4], 1);
    assert.equal(page.ownReview, null);
    const [product] = await db.select().from(schema.products).where(eq(schema.products.id, f.productId));
    assert.equal(Number(product.rating), 4);
    assert.equal(product.reviewCount, 1);
  });
  it("starts tracking only after payment verification and excludes customer private details", async () => {
    const f = await fixture();
    assert.equal((await trackingFor(db, f.order.id)).status, "awaiting_payment");
    await assert.rejects(updateDelivery(db, f.order.id, "owner@example.test", delivery("packed", 0)), /Confirm payment/);
    await f.pay(); await f.pay();
    const tracking = await trackingFor(db, f.order.id);
    assert.equal(tracking.status, "processing");
    assert.equal(tracking.events.length, 1);
    assert.deepEqual(tracking.destination, { city: "Ikeja", state: "Lagos" });
    const publicData = JSON.stringify(tracking);
    for (const sensitive of [f.user.email, "Private Address", "08012345678", f.user.name]) assert.equal(publicData.includes(sensitive), false);
    assert.equal((await receiptFor(db, f.order.id)).tracking?.status, "processing");
  });
  it("makes delivery updates idempotent, rejects skipped steps and concurrent overwrites, and supports issue resolution", async () => {
    const f = await fixture(); await f.pay();
    await assert.rejects(updateDelivery(db, f.order.id, "owner@example.test", delivery("shipped", 0)), /next delivery step/);
    const packed = delivery("packed", 0);
    await updateDelivery(db, f.order.id, "owner@example.test", packed);
    await updateDelivery(db, f.order.id, "owner@example.test", packed);
    assert.equal((await trackingFor(db, f.order.id)).events.length, 2);
    await assert.rejects(updateDelivery(db, f.order.id, "owner@example.test", delivery("shipped", 0)), /Another update/);
    await updateDelivery(db, f.order.id, "owner@example.test", delivery("shipped", 1));
    await updateDelivery(db, f.order.id, "owner@example.test", delivery("exception", 2));
    await assert.rejects(updateDelivery(db, f.order.id, "owner@example.test", delivery("packed", 3)), /next delivery step/);
    await updateDelivery(db, f.order.id, "owner@example.test", delivery("out_for_delivery", 3));
    const final = await updateDelivery(db, f.order.id, "owner@example.test", delivery("delivered", 4));
    assert.equal(final.status, "delivered");
    assert.ok(final.deliveredAt);
    assert.equal(final.version, 5);
    await assert.rejects(updateDelivery(db, f.order.id, "owner@example.test", delivery("shipped", 5)), /next delivery step/);
    assert.equal(JSON.stringify(final).includes("owner@example.test"), false);
  });
});

describe("Tracking capabilities, validation and concurrent cart reconciliation", () => {
  it("binds an expiring email tracking link to its exact order", () => {
    const paidAt = new Date("2026-10-01T00:00:00Z");
    const secret = "a-secure-session-secret-at-least-32-characters-long";
    const token = trackingAccessToken("KORA_reference", "order-a", paidAt, secret);
    const now = paidAt.getTime() + 60000;
    assert.equal(validTrackingAccess(token, "KORA_reference", "order-a", secret, now), true);
    assert.equal(validTrackingAccess(token, "KORA_other", "order-a", secret, now), false);
    assert.equal(validTrackingAccess(token, "KORA_reference", "order-b", secret, now), false);
    assert.equal(validTrackingAccess(token.slice(0,-1) + "g", "KORA_reference", "order-a", secret, now), false);
    assert.equal(validTrackingAccess(token, "KORA_reference", "order-a", secret, paidAt.getTime() + 91 * 86400000), false);
    assert.equal(validTrackingAccess(token, "KORA_reference", "order-a", "short", now), false);
  });
  it("preserves another device's additions while respecting an explicit item removal", () => {
    assert.deepEqual(rebaseCartLines([{ productId: "a", quantity: 2 }], [{ productId: "a", quantity: 3 }], [{ productId: "a", quantity: 4 }, { productId: "b", quantity: 1 }]), [{ productId: "a", quantity: 5 }, { productId: "b", quantity: 1 }]);
    assert.deepEqual(rebaseCartLines([{ productId: "a", quantity: 2 }], [], [{ productId: "a", quantity: 4 }, { productId: "b", quantity: 1 }]), [{ productId: "b", quantity: 1 }]);
    assert.equal(MAX_CATALOG_PRICE, 5000000);
  });
  it("requires useful reviews, courier details for dispatch and safe public tracking links", () => {
    assert.equal(reviewSchema.safeParse({ rating: 0, title: "No", body: "" }).success, false);
    const input = { status: "shipped", version: 0, idempotencyKey: randomUUID(), message: "Your order has been dispatched.", carrier: "Courier" };
    assert.equal(deliveryUpdateSchema.safeParse(input).success, true);
    assert.equal(deliveryUpdateSchema.safeParse({ ...input, carrier: "" }).success, false);
    for (const url of ["javascript:alert(1)", "http://courier.example/track", "https://localhost/track", "https://user:secret@courier.example"]) assert.equal(deliveryUpdateSchema.safeParse({ ...input, trackingUrl: url }).success, false);
    assert.equal(deliveryUpdateSchema.safeParse({ ...input, estimatedDeliveryAt: "2026-02-30" }).success, false);
  });
  it("adds an escaped tracking link only to actual payment receipts", () => {
    const receipt = { id: "id", reference: "ref", status: "paid", items: [], subtotalNaira: 10000, shippingNaira: 2500, totalNaira: 12500, shipping: { fullName: "Customer", email: "test@example.test", phone: "08012345678", address: "Street address", city: "Ikeja", state: "Lagos" }, createdAt: "2026-10-01", paidAt: "2026-10-01" };
    const url = "https://shop.example/track-order?reference=ref&access=token";
    const email = orderEmail(receipt, url);
    assert.ok(email.html.includes("reference=ref&amp;access=token"));
    assert.ok(email.text.includes(url));
    assert.equal(orderEmail({ ...receipt, demo: true }, url).text.includes("Track your delivery:"), false);
    assert.equal(orderEmail(receipt, "javascript:alert(1)").html.includes("javascript:"), false);
  });
});
