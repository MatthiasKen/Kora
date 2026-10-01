"use client";
import {
  useEffect,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Search,
  SlidersHorizontal,
  X,
  Zap,
} from "lucide-react";
import { useStore } from "./store-provider";
import { ProductCard } from "./product-card";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";
import { Button } from "./ui/button";
import { CATEGORIES } from "@/lib/catalog-data";
import { cn, money } from "@/lib/utils";
import { filterCatalog, MAX_CATALOG_PRICE } from "@/lib/catalog-tools";
const collectionNames: Record<string, string> = {
  new: "Fresh finds, just landed.",
  bestsellers: "The everyday favourites.",
  deals: "Good finds. Great prices.",
};
export function ProductCatalog() {
  const { products } = useStore();
  const urlParams = useSearchParams();
  const [queryString, setOptimisticQuery] = useOptimistic(urlParams.toString());
  const [pending, startTransition] = useTransition();
  const params = new URLSearchParams(queryString);
  const router = useRouter();
  const category = params.get("category") || "All products";
  const collection = params.get("collection") || "all";
  const q = params.get("q") || "";
  const ceiling = MAX_CATALOG_PRICE;
  const sort = ["price-low", "price-high", "rating", "newest"].includes(
    params.get("sort") || "",
  )
    ? params.get("sort")!
    : "featured";
  const requestedMax = Number(params.get("max") ?? ceiling);
  const priceMax = Number.isFinite(requestedMax)
    ? Math.min(ceiling, Math.max(0, requestedMax))
    : ceiling;
  const onSale = params.get("sale") === "1";
  const inStock = params.get("stock") === "1";
  const ratingMin = [1, 2, 3, 4, 4.5, 5].includes(Number(params.get("rating")))
    ? Number(params.get("rating"))
    : 0;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (
      !value ||
      value === "all" ||
      value === "All products" ||
      value === "featured"
    )
      next.delete(key);
    else next.set(key, value);
    startTransition(() => {
      setOptimisticQuery(next.toString());
      router.push(`/shop${next.size ? `?${next}` : ""}`, { scroll: false });
    });
  }
  const visible = useMemo(
    () =>
      filterCatalog(
        products,
        {
          category,
          collection,
          query: q,
          priceMax,
          onSale,
          inStock,
          ratingMin,
          sort,
        },
        now || Date.now(),
      ),
    [
      products,
      category,
      collection,
      q,
      priceMax,
      onSale,
      inStock,
      ratingMin,
      sort,
      now,
    ],
  );
  function reset() {
    startTransition(() => {
      setOptimisticQuery("");
      router.push("/shop", { scroll: false });
    });
  }
  const filters = (prefix: string) => (
    <div className="catalog-filters">
      <div className="filter-heading">
        <h3>Categories</h3>
        <button onClick={reset}>Reset</button>
      </div>
      {CATEGORIES.map((c) => (
        <button
          key={c}
          className={cn("filter-category", category === c && "selected")}
          aria-pressed={category === c}
          onClick={() => updateFilter("category", c)}
        >
          <span className="filter-check">
            {category === c && <Check size={12} />}
          </span>
          {c}
          <small>
            {c === "All products"
              ? products.length
              : products.filter((p) => p.category === c).length}
          </small>
        </button>
      ))}
      <div className="filter-divider" />
      <h3>Price range</h3>
      <input
        className="price-slider"
        type="range"
        min={0}
        max={ceiling}
        step={500}
        value={priceMax}
        onChange={(e) =>
          updateFilter(
            "max",
            Number(e.target.value) >= ceiling ? "" : e.target.value,
          )
        }
        aria-label="Maximum product price"
        aria-valuetext={money(priceMax)}
      />
      <div className="price-range-labels">
        <span>₦0</span>
        <b>{money(priceMax)}</b>
      </div>
      <label className="price-limit-input" htmlFor={prefix + "price-limit"}>
        Maximum price (₦)
        <input id={prefix + "price-limit"} type="number" min={0} max={ceiling} step={500}
          value={priceMax} onChange={(e) => {
            const value = Math.min(ceiling, Math.max(0, Number(e.target.value)));
            updateFilter("max", value >= ceiling ? "" : String(value));
          }} />
      </label>
      <div className="filter-divider" />
      <label className="sale-filter">
        <input
          type="checkbox"
          checked={onSale}
          onChange={(e) => updateFilter("sale", e.target.checked ? "1" : "")}
        />
        Only good deals <Zap size={14} />
      </label>
      <label className="sale-filter">
        <input
          type="checkbox"
          checked={inStock}
          onChange={(e) => updateFilter("stock", e.target.checked ? "1" : "")}
        />
        In stock only
      </label>
      <label className="rating-filter">
        Customer rating
        <select
          aria-label="Minimum product rating"
          value={ratingMin}
          onChange={(e) =>
            updateFilter("rating", Number(e.target.value) ? e.target.value : "")
          }
        >
          <option value="0">All ratings</option>
          <option value="1">1 star & above</option>
          <option value="2">2 stars & above</option>
          <option value="3">3 stars & above</option>
          <option value="4">4 stars & above</option>
          <option value="4.5">4.5 stars & above</option>
          <option value="5">5 stars</option>
        </select>
      </label>
      <div className="filter-tip">
        <span className="eyebrow">A LITTLE KORA TIP</span>
        <p>
          Orders over ₦100,000 come with free delivery. A good excuse for one
          more favourite.
        </p>
      </div>
    </div>
  );
  return (
    <div className="page-width catalog-page" aria-busy={pending}>
      <div className="breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>
          {q
            ? "Search"
            : category !== "All products"
              ? category
              : collection !== "all"
                ? collection === "new"
                  ? "New arrivals"
                  : collection === "deals"
                    ? "Daily deals"
                    : "Best sellers"
                : "Shop all"}
        </span>
      </div>
      <div className="catalog-title">
        <p className="eyebrow">THE KORA COLLECTION</p>
        <h1>
          {q
            ? `Good finds for “${q}”`
            : category !== "All products"
              ? category
              : collectionNames[collection] || "Your everyday, elevated."}
        </h1>
        <p>Thoughtfully picked. Fairly priced. Ready for your everyday.</p>
      </div>
      <div className="catalog-collections">
        {[
          ["all", "All products"],
          ["new", "New arrivals"],
          ["bestsellers", "Best sellers"],
          ["deals", "Daily deals"],
        ].map(([id, title]) => (
          <button
            key={id}
            className={cn(collection === id && "selected")}
            aria-pressed={collection === id}
            onClick={() => updateFilter("collection", id)}
          >
            {id === "deals" && <Zap size={14} />}
            {title}
          </button>
        ))}
      </div>
      <div className="catalog-layout">
        <aside className="catalog-sidebar">{filters("")}</aside>
        <div>
          <div className="catalog-toolbar">
            <span>
              <b>{visible.length}</b> good{" "}
              {visible.length === 1 ? "find" : "finds"}
              {q && (
                <>
                  {" "}
                  for <b>“{q}”</b>
                </>
              )}
            </span>
            <button
              className="filter-mobile-button"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal size={16} />
              Filters
            </button>
            <label>
              <span className="hidden sm:inline">Sort by:</span>
              <select
                aria-label="Sort products"
                value={sort}
                onChange={(e) => updateFilter("sort", e.target.value)}
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="newest">New arrivals first</option>
                <option value="rating">Top rated</option>
              </select>
            </label>
          </div>
          {(category !== "All products" ||
            q ||
            onSale ||
            inStock ||
            ratingMin ||
            priceMax < ceiling) && (
            <div className="active-filters">
              {category !== "All products" && (
                <button
                  onClick={() => updateFilter("category", "All products")}
                >
                  {category}
                  <X size={12} />
                </button>
              )}
              {q && (
                <button onClick={() => updateFilter("q", "")}>
                  {q}
                  <X size={12} />
                </button>
              )}
              {onSale && (
                <button onClick={() => updateFilter("sale", "")}>
                  On sale
                  <X size={12} />
                </button>
              )}
              {inStock && (
                <button onClick={() => updateFilter("stock", "")}>
                  In stock
                  <X size={12} />
                </button>
              )}
              {!!ratingMin && (
                <button onClick={() => updateFilter("rating", "")}>
                  {ratingMin}+ stars
                  <X size={12} />
                </button>
              )}
              {priceMax < ceiling && (
                <button onClick={() => updateFilter("max", "")}>
                  Under {money(priceMax)}
                  <X size={12} />
                </button>
              )}
            </div>
          )}
          {visible.length ? (
            <div className="catalog-product-grid">
              {visible.map((p, i) => (
                <ProductCard product={p} index={i} key={p.id} />
              ))}
            </div>
          ) : (
            <div className="no-results">
              <Search size={32} strokeWidth={1.3} />
              <h2>No finds just yet.</h2>
              <p>
                Try a different search or give your filters a little more room.
              </p>
              <Button onClick={reset}>
                Explore all products <ArrowRight size={17} />
              </Button>
            </div>
          )}
        </div>
      </div>
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent>
          <SheetTitle className="p-7 text-xl">Find your favourites</SheetTitle>
          <SheetDescription className="sr-only">
            Filter products by category, price, and deals.
          </SheetDescription>
          <div className="px-7">
            {filters("mobile-")}
            <Button
              className="mt-6 w-full"
              onClick={() => setFiltersOpen(false)}
            >
              See {visible.length} good finds <ArrowRight size={17} />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
