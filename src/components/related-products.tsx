"use client";
import { useStore } from "./store-provider";
import { ProductCard } from "./product-card";
export function RelatedProducts({
  productId,
  category,
}: {
  productId: string;
  category: string;
}) {
  const { products } = useStore();
  const related = products
    .filter((p) => p.id !== productId)
    .sort(
      (a, b) =>
        Number(b.category === category) - Number(a.category === category),
    )
    .slice(0, 4);
  return (
    <section className="page-width related-section">
      <p className="eyebrow">GOOD THINGS GO TOGETHER</p>
      <h2>You might love these, too.</h2>
      <div className="product-grid mt-8">
        {related.map((p, i) => (
          <ProductCard product={p} index={i} key={p.id} />
        ))}
      </div>
    </section>
  );
}
