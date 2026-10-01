import { and, asc, avg, count, desc, eq, isNotNull } from "drizzle-orm";
import type { Database } from "@/db";
import { orderItems, orders, productReviews, products, users } from "@/db/schema";
import type { Review, ReviewPage, ReviewSummary } from "./types";
import { reviewAuthor } from "./reviews";
import { AppError } from "./errors";
import { reviewSchema } from "./validation";
import type { z } from "zod";

const publicFields = {
  id: productReviews.id, productId: productReviews.productId,
  author: users.name, rating: productReviews.rating, title: productReviews.title,
  body: productReviews.body, createdAt: productReviews.createdAt, updatedAt: productReviews.updatedAt,
};
function publicReview(row: { id: string; productId: string; author: string; rating: number; title: string; body: string; createdAt: Date; updatedAt: Date }): Review {
  return { ...row, author: reviewAuthor(row.author), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), verifiedPurchase: true };
}
export async function reviewableOrder(db: Database, productId: string, userId: string) {
  const [order] = await db.select({ id: orders.id }).from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(and(eq(orders.userId, userId), eq(orders.status, "paid"), isNotNull(orders.paidAt), eq(orderItems.productId, productId)))
    .orderBy(desc(orders.paidAt)).limit(1);
  return order?.id ?? null;
}
export async function getReviewPage(db: Database, productId: string, userId: string | null = null, page = 1, sort = "recent"): Promise<ReviewPage> {
  const totals = await db.select({ rating: productReviews.rating, count: count() }).from(productReviews)
    .where(eq(productReviews.productId, productId)).groupBy(productReviews.rating);
  const summary: ReviewSummary = { count: 0, average: 0, distribution: {1:0,2:0,3:0,4:0,5:0} };
  let sum = 0;
  for (const row of totals) { summary.count += row.count; sum += row.rating * row.count; summary.distribution[row.rating] = row.count; }
  if (summary.count) summary.average = Math.round(sum / summary.count * 10) / 10;
  const rows = await db.select(publicFields).from(productReviews)
    .innerJoin(users, eq(users.id, productReviews.userId)).where(eq(productReviews.productId, productId))
    .orderBy(...(sort === "highest" ? [desc(productReviews.rating)] : sort === "lowest" ? [asc(productReviews.rating)] : []), desc(productReviews.createdAt), desc(productReviews.id))
    .limit(10).offset((page - 1) * 10);
  const own = userId ? await db.select(publicFields).from(productReviews).innerJoin(users, eq(users.id, productReviews.userId))
    .where(and(eq(productReviews.productId, productId), eq(productReviews.userId, userId))).limit(1) : [];
  return { reviews: rows.map(publicReview), summary, hasMore: page * 10 < summary.count, page,
    eligible: !!userId && !!(await reviewableOrder(db, productId, userId)), ownReview: own[0] ? publicReview(own[0]) : null };
}
export async function saveProductReview(db: Database, productId: string, userId: string, value: z.infer<typeof reviewSchema>) {
  return db.transaction(async (tx) => {
    const [product] = await tx.select({ id: products.id }).from(products).where(eq(products.id, productId)).for("update");
    if (!product) throw new AppError("Product not found.", 404);
    const orderId = await reviewableOrder(tx as unknown as Database, productId, userId);
    if (!orderId) throw new AppError("Reviews are available after a confirmed purchase of this item.", 403);
    await tx.insert(productReviews).values({ productId, userId, orderId, ...value })
      .onConflictDoUpdate({ target: [productReviews.userId, productReviews.productId], set: { ...value, orderId, updatedAt: new Date() } });
    const [summary] = await tx.select({ count: count(), average: avg(productReviews.rating) }).from(productReviews).where(eq(productReviews.productId, productId));
    await tx.update(products).set({ reviewCount: summary.count, rating: Number(summary.average || 0).toFixed(1) }).where(eq(products.id, productId));
  });
}
