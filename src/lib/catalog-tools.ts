import type { Product } from "./types";
import { activeDeal, effectivePrice } from "./utils";
export const MAX_CATALOG_PRICE = 5_000_000;

export function productMatches(product: Product, query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const text =
    `${product.title} ${product.category} ${product.description}`.toLowerCase();
  return words.every((word) => text.includes(word));
}
export type CatalogFilters = {
  category: string;
  collection: string;
  query: string;
  priceMax: number;
  onSale: boolean;
  inStock: boolean;
  ratingMin: number;
  sort: string;
};
export function filterCatalog(
  products: Product[],
  filters: CatalogFilters,
  now = Date.now(),
) {
  return products
    .filter((p) => {
      const price = effectivePrice(p, now);
      return (
        (filters.category === "All products" ||
          p.category === filters.category) &&
        (filters.collection === "new"
          ? p.isNewArrival
          : filters.collection === "bestsellers"
            ? p.isBestSeller
            : filters.collection === "deals"
              ? activeDeal(p, now)
              : true) &&
        productMatches(p, filters.query) &&
        price <= filters.priceMax &&
        (!filters.onSale ||
          (!!p.originalPriceNaira && price < p.originalPriceNaira)) &&
        (!filters.inStock || p.stock > p.reserved) &&
        Number(p.rating) >= filters.ratingMin
      );
    })
    .sort((a, b) =>
      filters.sort === "price-low"
        ? effectivePrice(a, now) - effectivePrice(b, now)
        : filters.sort === "price-high"
          ? effectivePrice(b, now) - effectivePrice(a, now)
          : filters.sort === "rating"
            ? Number(b.rating) - Number(a.rating)
            : filters.sort === "newest"
              ? Number(b.isNewArrival) - Number(a.isNewArrival)
              : Number(b.isBestSeller) - Number(a.isBestSeller),
    );
}
export function knownProductIds(
  value: unknown,
  products: Product[],
  limit: number,
) {
  if (!Array.isArray(value)) return [];
  const known = new Set(products.map((p) => p.id));
  return [
    ...new Set(
      value.filter(
        (id): id is string => typeof id === "string" && known.has(id),
      ),
    ),
  ].slice(0, limit);
}
