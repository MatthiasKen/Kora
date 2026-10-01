import { notFound } from "next/navigation";
import { getProducts } from "@/lib/catalog";
import { ProductPage } from "@/components/product-detail";
import { RelatedProducts } from "@/components/related-products";
import { RecentlyViewed } from "@/components/recently-viewed";
import { ProductReviews } from "@/components/product-reviews";
import { getReviewPage } from "@/lib/review-service";
import { getDb } from "@/db";
import { isDemo } from "@/lib/config";
import { summarizeReviews } from "@/lib/reviews";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = (await getProducts()).find((p) => p.slug === slug);
  return {
    title: product?.title || "Product not found",
    description: product?.description,
  };
}
export default async function Product({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = (await getProducts()).find((p) => p.slug === slug);
  if (!product) notFound();
  const reviews = isDemo() ? { reviews: [], summary: summarizeReviews([]), hasMore: false, page: 1, eligible: false, ownReview: null } : await getReviewPage(getDb(), product.id);
  return (
    <>
      <ProductPage product={product} />
      <ProductReviews productId={product.id} initial={reviews} />
      <RelatedProducts productId={product.id} category={product.category} />
      <RecentlyViewed exclude={product.id} />
    </>
  );
}
