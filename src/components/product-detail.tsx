"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Heart,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
} from "lucide-react";
import type { Product } from "@/lib/types";
import { useStore } from "./store-provider";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { QuantityControl } from "./cart-drawer";
import {
  deliveryFee,
  effectivePrice,
  money,
  NIGERIAN_STATES,
  percentOff,
} from "@/lib/utils";
import { Countdown } from "./countdown";
import { ReviewStars } from "./star-rating";
export function ProductInfo({
  product,
  close,
}: {
  product: Product;
  close?: () => void;
}) {
  const {
    addItem,
    wishlist,
    toggleWishlist,
    compare,
    toggleCompare,
    deliveryState,
    setDeliveryState,
  } = useStore();
  const [quantity, setQuantity] = useState(1);
  const price = effectivePrice(product);
  const discount = percentOff(price, product.originalPriceNaira);
  const stock = Math.max(0, product.stock - product.reserved);
  return (
    <div className="product-detail-info">
      <p className="eyebrow">{product.category}</p>
      <h1>{product.title}</h1>
      <div className="detail-rating">
        <ReviewStars rating={Number(product.rating)} size={14} />
        {close ? <span>{product.reviewCount ? product.rating + " · " + product.reviewCount + (product.reviewCount === 1 ? " review" : " reviews") : "No reviews yet"}</span> : <a href="#reviews">{product.reviewCount ? product.rating + " · " + product.reviewCount + (product.reviewCount === 1 ? " review" : " reviews") : "No reviews yet · Write a review"}</a>}
      </div>
      <div className="detail-price">
        <strong>{money(price)}</strong>
        {discount > 0 && (
          <>
            <s>{money(product.originalPriceNaira!)}</s>
            <span className="discount-badge">Save {discount}%</span>
          </>
        )}
      </div>
      <p className="detail-description">{product.description}</p>
      <ul className="product-features">
        {product.features.map((f) => (
          <li key={f}>
            <Check size={15} />
            {f}
          </li>
        ))}
      </ul>
      {product.isDailyDeal &&
        product.dealEndsAt &&
        new Date(product.dealEndsAt).getTime() > Date.now() && (
          <div className="detail-deal">
            <span>Today's good find ends in</span>
            <Countdown endsAt={product.dealEndsAt} compact />
          </div>
        )}
      <div className="stock-label">
        <span className={stock ? "stock-dot" : "stock-dot stock-unavailable"} />
        {stock ? `In stock · ${stock} available` : "Out of stock"}
      </div>
      <div className="detail-actions">
        <QuantityControl
          quantity={quantity}
          onChange={setQuantity}
          max={Math.min(99, stock)}
          label={product.title}
        />
        <Button
          disabled={!stock}
          className="flex-1"
          onClick={() => {
            addItem(product.id, quantity);
            close?.();
          }}
        >
          <ShoppingBag size={17} />
          {stock ? "Add to bag" : "Out of stock"}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => toggleWishlist(product.id)}
          aria-label={
            wishlist.includes(product.id)
              ? "Remove from wishlist"
              : "Save to wishlist"
          }
        >
          <Heart
            size={19}
            fill={wishlist.includes(product.id) ? "currentColor" : "none"}
          />
        </Button>
      </div>
      <button
        className="detail-compare"
        aria-pressed={compare.includes(product.id)}
        onClick={() => toggleCompare(product.id)}
      >
        <SlidersHorizontal size={16} />
        {compare.includes(product.id)
          ? "Added to comparison"
          : "Add to comparison"}
      </button>
      {!close && (
        <div className="delivery-estimate">
          <label htmlFor="product-delivery-state">
            <Truck size={17} />
            Estimate your delivery
          </label>
          <div>
            <select
              id="product-delivery-state"
              value={deliveryState}
              onChange={(e) => setDeliveryState(e.target.value)}
            >
              {NIGERIAN_STATES.map((state) => (
                <option key={state}>{state}</option>
              ))}
            </select>
            <strong>
              {deliveryFee(price * quantity, deliveryState)
                ? money(deliveryFee(price * quantity, deliveryState))
                : "Free delivery"}
            </strong>
          </div>
          <small>
            Based on this item and quantity. Your full bag's delivery fee is
            calculated at checkout.
          </small>
        </div>
      )}
      <div className="product-assurances">
        <span>
          <Truck size={16} />
          Nationwide delivery
        </span>
        <span>
          <ShieldCheck size={16} />
          Secure checkout
        </span>
      </div>
    </div>
  );
}
export function QuickView() {
  const { quickView, setQuickView } = useStore();
  return (
    <Dialog
      open={!!quickView}
      onOpenChange={(open) => {
        if (!open) setQuickView(null);
      }}
    >
      <DialogContent className="quick-view-content">
        {quickView && (
          <>
            <DialogTitle className="sr-only">{quickView.title}</DialogTitle>
            <DialogDescription className="sr-only">
              Product details, price and add to bag.
            </DialogDescription>
            <div className="quick-view-photo">
              <Image
                src={quickView.imageUrl}
                alt={quickView.title}
                fill
                sizes="(max-width: 700px) 90vw, 450px"
              />
            </div>
            <ProductInfo
              key={quickView.id}
              product={quickView}
              close={() => setQuickView(null)}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function ProductPage({ product }: { product: Product }) {
  const { rememberProduct, hydrated, products } = useStore();
  const currentProduct = products.find(item => item.id === product.id) || product;
  useEffect(() => {
    if (hydrated) rememberProduct(product.id);
  }, [product.id, hydrated, rememberProduct]);
  return (
    <div className="page-width product-page">
      <div className="breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href={`/shop?category=${encodeURIComponent(product.category)}`}>
          {product.category}
        </Link>
        <span>/</span>
        <span>{product.title}</span>
      </div>
      <div className="product-page-grid">
        <div className="product-main-photo">
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            priority
            sizes="(max-width: 800px) 90vw, 50vw"
          />
        </div>
        <ProductInfo key={product.id} product={currentProduct} />
      </div>
      <section className="about-item" aria-labelledby="about-item-title"><div><p className="eyebrow">THE DETAILS THAT MATTER</p><h2 id="about-item-title">About this item</h2><p>{product.description}</p></div><div><dl><div><dt>Category</dt><dd>{product.category}</dd></div><div><dt>Item code</dt><dd>{product.id}</dd></div></dl><ul className="product-features">{product.features.map(feature => <li key={feature}><Check size={16} />{feature}</li>)}</ul></div></section>
    </div>
  );
}
