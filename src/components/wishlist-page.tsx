"use client";
import Link from "next/link";
import { Heart, ArrowRight } from "lucide-react";
import { useStore } from "./store-provider";
import { ProductCard } from "./product-card";
import { Button } from "./ui/button";
export function WishlistPage() {
  const { wishlist, products, hydrated } = useStore();
  const saved = products.filter((p) => wishlist.includes(p.id));
  return (
    <div className="page-width wishlist-page">
      <div className="breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Your favourites</span>
      </div>
      <p className="eyebrow">A LITTLE LIST OF LOVES</p>
      <h1>Saved for a good day.</h1>
      <p className="text-subtle mt-3 mb-10">
        {saved.length
          ? `${saved.length} everyday favourites, ready when you are.`
          : "Keep the things you love close by."}
      </p>
      {!hydrated ? (
        <p>Loading your favourites...</p>
      ) : saved.length ? (
        <div className="product-grid">
          {saved.map((p, i) => (
            <ProductCard product={p} key={p.id} index={i} />
          ))}
        </div>
      ) : (
        <div className="empty-wishlist">
          <Heart size={35} strokeWidth={1.3} />
          <h2>A little room for your favourites.</h2>
          <p>Tap the heart on any product to save it here.</p>
          <Button asChild>
            <Link href="/shop">
              Find something to love <ArrowRight size={17} />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
