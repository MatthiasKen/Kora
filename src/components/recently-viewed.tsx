"use client";
import { useStore } from "./store-provider";
import { ProductCard } from "./product-card";
export function RecentlyViewed({ exclude }: { exclude?: string }) {
  const { recent, products } = useStore();
  const viewed = recent
    .filter((id) => id !== exclude)
    .map((id) => products.find((p) => p.id === id))
    .filter((p) => !!p)
    .slice(0, 4);
  if (!viewed.length) return null;
  return (
    <section className="page-width recently-viewed-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PICK UP WHERE YOU LEFT OFF</p>
          <h2>Still on your mind?</h2>
        </div>
        <span className="section-count">Recently viewed</span>
      </div>
      <div className="product-grid">
        {viewed.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
