"use client";
import Link from "next/link";
import Image from "next/image";
import { Heart, Plus, Eye, SlidersHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { useStore } from "./store-provider";
import { ReviewStars } from "./star-rating";
import { money, effectivePrice, percentOff, cn } from "@/lib/utils";
import type { Product } from "@/lib/types";
export function ProductCard({
  product,
  index = 0,
}: {
  product: Product;
  index?: number;
}) {
  const {
    wishlist,
    toggleWishlist,
    addItem,
    setQuickView,
    compare,
    toggleCompare,
  } = useStore();
  const price = effectivePrice(product);
  const discount = percentOff(price, product.originalPriceNaira);
  const saved = wishlist.includes(product.id);
  const soldOut = product.stock - product.reserved <= 0;
  return (
    <motion.article
      initial={{ opacity: 1, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.4, delay: Math.min(index, 3) * 0.05 }}
      className="product-card group"
    >
      <div className="product-photo" style={{ backgroundColor: product.color }}>
        <Link
          href={`/product/${product.slug}`}
          aria-label={`View ${product.title}`}
        >
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 24vw"
            className="product-image"
          />
        </Link>
        <div className="product-badges">
          {soldOut ? <span className="sold-out-badge">Out of stock</span> : discount > 0 && <span className="discount-badge">−{discount}%</span>}
          {!soldOut && !discount && product.isNewArrival && (
            <span className="new-badge">NEW</span>
          )}
        </div>
        <button
          className={cn("product-save", saved && "is-saved")}
          onClick={() => toggleWishlist(product.id)}
          aria-label={`${saved ? "Remove" : "Save"} ${product.title}${saved ? " from" : " to"} wishlist`}
        >
          <Heart size={17} fill={saved ? "currentColor" : "none"} />
        </button>
        <button
          className="product-quickview"
          onClick={() => setQuickView(product)}
          aria-label={`Quick view ${product.title}`}
        >
          <Eye size={16} /> Quick view
        </button>
        <button
          className={cn(
            "product-compare",
            compare.includes(product.id) && "selected",
          )}
          onClick={() => toggleCompare(product.id)}
          aria-label={`Compare ${product.title}`}
          aria-pressed={compare.includes(product.id)}
          title="Compare product"
        >
          <SlidersHorizontal size={16} />
        </button>
        <button
          className="product-add"
          onClick={() => addItem(product.id)}
          disabled={soldOut}
          title={soldOut ? "Out of stock" : "Add to bag"}
          aria-label={`Add ${product.title} to bag`}
        >
          <Plus size={21} />
        </button>
      </div>
      <div className="product-meta">
        <span>{product.category}</span>
        <span className="product-rating">
          <ReviewStars rating={product.reviewCount ? Number(product.rating) : 0} size={12} />
          {product.reviewCount ? <>{product.rating} <small>({product.reviewCount})</small></> : <small>No reviews</small>}
        </span>
      </div>
      <Link className="product-title" href={`/product/${product.slug}`}>
        {product.title}
      </Link>
      <div className="product-price">
        <strong>{money(price)}</strong>
        {product.originalPriceNaira && product.originalPriceNaira > price && (
          <s>{money(product.originalPriceNaira)}</s>
        )}
        {soldOut && (
          <small className="text-subtle">Out of stock</small>
        )}
      </div>
    </motion.article>
  );
}
