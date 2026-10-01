import type { Review, ReviewSummary } from "./types";
import { reviewSchema } from "./validation";
export const DEMO_REVIEW_KEY = "kora-demo-reviews-v1";
export function summarizeReviews(rows: Pick<Review, "rating">[]): ReviewSummary {
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of rows) distribution[row.rating]++;
  return { count: rows.length, average: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.rating, 0) / rows.length * 10) / 10 : 0, distribution };
}
export function readDemoReviews(): Review[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DEMO_REVIEW_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((row): row is Review =>
      !!row && typeof row === "object" && typeof row.id === "string" &&
      typeof row.productId === "string" && typeof row.authorId === "string" &&
      typeof row.author === "string" && typeof row.createdAt === "string" &&
      !Number.isNaN(Date.parse(row.createdAt)) && typeof row.updatedAt === "string" &&
      row.demo === true && reviewSchema.safeParse(row).success,
    ).slice(0, 500);
  } catch { return []; }
}
export function reviewAuthor(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[0] + (parts.length > 1 ? " " + parts.at(-1)![0] + "." : "");
}
