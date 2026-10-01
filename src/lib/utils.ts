import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...values: ClassValue[]) {
  return twMerge(clsx(values));
}
export const money = (amount: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
export const percentOff = (price: number, original: number | null) =>
  original && original > price ? Math.round((1 - price / original) * 100) : 0;
export function effectivePrice(
  product: {
    priceNaira: number;
    originalPriceNaira: number | null;
    isDailyDeal: boolean;
    dealEndsAt: string | Date | null;
  },
  now = Date.now(),
) {
  return product.isDailyDeal &&
    product.dealEndsAt &&
    new Date(product.dealEndsAt).getTime() <= now &&
    product.originalPriceNaira
    ? product.originalPriceNaira
    : product.priceNaira;
}
export function activeDeal(
  product: { isDailyDeal: boolean; dealEndsAt: string | Date | null },
  now = Date.now(),
) {
  return (
    product.isDailyDeal &&
    !!product.dealEndsAt &&
    new Date(product.dealEndsAt).getTime() > now
  );
}
export function mergeCartLines(
  account: { productId: string; quantity: number }[],
  guest: { productId: string; quantity: number }[],
  baseline: { productId: string; quantity: number }[] = [],
) {
  const result = new Map(
    account.map((item) => [item.productId, item.quantity]),
  );
  const previous = new Map(
    baseline.map((item) => [item.productId, item.quantity]),
  );
  const current = new Map(guest.map((item) => [item.productId, item.quantity]));
  for (const id of new Set([...previous.keys(), ...current.keys()])) {
    const quantity = Math.max(
      0,
      (result.get(id) ?? 0) + (current.get(id) ?? 0) - (previous.get(id) ?? 0),
    );
    if (quantity) result.set(id, Math.min(quantity, 99));
    else result.delete(id);
  }
  return [...result].map(([productId, quantity]) => ({ productId, quantity }));
}
export const NIGERIAN_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Federal Capital Territory",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const;
export function deliveryFee(subtotal: number, state = "Lagos") {
  return subtotal >= 100000
    ? 0
    : state === "Lagos"
      ? 2500
      : ["Ogun", "Oyo", "Osun", "Ondo", "Ekiti"].includes(state)
        ? 3500
        : 5000;
}
