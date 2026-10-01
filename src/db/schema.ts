import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  uuid,
  integer,
  timestamp,
  boolean,
  jsonb,
  numeric,
  primaryKey,
  check,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { CartLine, ShippingAddress } from "@/lib/types";
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  image: text("image"),
  phone: text("phone"),
  shipping: jsonb("shipping").$type<ShippingAddress>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    priceNaira: integer("price_naira").notNull(),
    originalPriceNaira: integer("original_price_naira"),
    stock: integer("stock").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    imageUrl: text("image_url").notNull(),
    color: text("color").notNull().default("#eee9e1"),
    isDailyDeal: boolean("is_daily_deal").notNull().default(false),
    isBestSeller: boolean("is_best_seller").notNull().default(false),
    isNewArrival: boolean("is_new_arrival").notNull().default(false),
    dealEndsAt: timestamp("deal_ends_at", { withTimezone: true }),
    rating: numeric("rating", { precision: 2, scale: 1 })
      .notNull()
      .default("0"),
    reviewCount: integer("review_count").notNull().default(0),
    features: jsonb("features").$type<string[]>().notNull().default([]),
  },
  (t) => [
    check("product_price_positive", sql`${t.priceNaira} > 0`),
    check(
      "product_original_valid",
      sql`${t.originalPriceNaira} IS NULL OR ${t.originalPriceNaira} >= ${t.priceNaira}`,
    ),
    check(
      "product_inventory_valid",
      sql`${t.stock} >= 0 AND ${t.reserved} >= 0 AND ${t.reserved} <= ${t.stock}`,
    ),
    index("products_category_idx").on(t.category),
  ],
);
export const carts = pgTable(
  "carts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    sessionHash: text("session_hash").unique(),
    revision: integer("revision").notNull().default(0),
    snapshotUserId: uuid("snapshot_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    snapshot: jsonb("snapshot").$type<CartLine[]>().notNull().default([]),
    mergedInto: uuid("merged_into"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "cart_owner_required",
      sql`${t.userId} IS NOT NULL OR ${t.sessionHash} IS NOT NULL`,
    ),
  ],
);
export const cartItems = pgTable(
  "cart_items",
  {
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    quantity: integer("quantity").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.cartId, t.productId] }),
    check("cart_quantity_valid", sql`${t.quantity} BETWEEN 1 AND 99`),
  ],
);
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id),
    email: text("email").notNull(),
    paystackReference: text("paystack_reference").notNull().unique(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    accessHash: text("access_hash").notNull(),
    authorizationUrl: text("authorization_url"),
    subtotalNaira: integer("subtotal_naira").notNull(),
    shippingNaira: integer("shipping_naira").notNull(),
    totalAmountNaira: integer("total_amount_naira").notNull(),
    status: text("status").notNull().default("pending"),
    shippingAddress: jsonb("shipping_address")
      .$type<ShippingAddress>()
      .notNull(),
    reservationActive: boolean("reservation_active").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    deliveryStatus: text("delivery_status").notNull().default("awaiting_payment"),
    deliveryVersion: integer("delivery_version").notNull().default(0),
    carrier: text("carrier"),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    estimatedDeliveryAt: timestamp("estimated_delivery_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    deliveryUpdatedAt: timestamp("delivery_updated_at", { withTimezone: true }),
  },
  (t) => [
    index("orders_user_idx").on(t.userId),
    index("orders_expiry_idx").on(t.status, t.expiresAt),
    check(
      "order_total_valid",
      sql`${t.totalAmountNaira} = ${t.subtotalNaira} + ${t.shippingNaira} AND ${t.subtotalNaira} > 0`,
    ),
    check(
      "order_status_valid",
      sql`${t.status} IN ('pending', 'paid', 'expired', 'failed', 'fulfillment_review')`,
    ),
    check("order_delivery_status_valid", sql`${t.deliveryStatus} IN ('awaiting_payment', 'payment_review', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'exception')`),
  ],
);
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    title: text("title").notNull(),
    imageUrl: text("image_url").notNull(),
    quantity: integer("quantity").notNull(),
    priceAtPurchase: integer("price_at_purchase").notNull(),
    originalPriceNaira: integer("original_price_naira"),
  },
  (t) => [
    uniqueIndex("order_product_unique").on(t.orderId, t.productId),
    check(
      "order_item_valid",
      sql`${t.quantity} > 0 AND ${t.priceAtPurchase} > 0`,
    ),
  ],
);
export const emailOutbox = pgTable("email_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id)
    .unique(),
  attempts: integer("attempts").notNull().default(0),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const productReviews = pgTable("product_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  rating: integer("rating").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("review_customer_product_unique").on(t.userId, t.productId),
  index("reviews_product_created_idx").on(t.productId, t.createdAt),
  check("review_rating_valid", sql`${t.rating} BETWEEN 1 AND 5`),
  check("review_content_valid", sql`length(${t.title}) BETWEEN 3 AND 120 AND length(${t.body}) BETWEEN 10 AND 1500`),
]);

export const deliveryEvents = pgTable("delivery_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  message: text("message").notNull(),
  location: text("location"),
  actorEmail: text("actor_email"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("delivery_events_order_idx").on(t.orderId, t.createdAt)]);
