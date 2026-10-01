import { getDb } from "@/db";
import { products, productReviews } from "@/db/schema";
import { avg, count } from "drizzle-orm";
import { isDemo } from "./config";
import { demoProducts } from "./catalog-data";
import type { Product } from "./types";
export async function getProducts(): Promise<Product[]> {
  if (isDemo()) return demoProducts();
  const db = getDb();
  const [rows, scores] = await Promise.all([
    db.select().from(products).orderBy(products.title),
    db.select({ productId: productReviews.productId, average: avg(productReviews.rating), count: count() }).from(productReviews).groupBy(productReviews.productId),
  ]);
  const ratings = new Map(scores.map(score => [score.productId, score]));
  return rows.map((p) => ({
    ...p,
    rating: Number(ratings.get(p.id)?.average || 0).toFixed(1),
    reviewCount: ratings.get(p.id)?.count || 0,
    dealEndsAt: p.dealEndsAt?.toISOString() ?? null,
  }));
}
