import type { CartLine } from "./types";

export function cartStorageKey(demo: boolean, userId?: string | null) {
  return `kora-bag-v2:${demo ? "demo" : "live"}:${userId ? `account:${encodeURIComponent(userId)}` : "guest"}`;
}
// Apply this device's changes to the latest account bag without replacing
// additions from another device. Removing an item is an explicit removal.
export function rebaseCartLines(base: CartLine[], local: CartLine[], remote: CartLine[]): CartLine[] {
  const before = new Map(base.map(line => [line.productId, line.quantity]));
  const desired = new Map(local.map(line => [line.productId, line.quantity]));
  const result = new Map(remote.map(line => [line.productId, line.quantity]));
  for (const id of new Set([...before.keys(), ...desired.keys()])) {
    const old = before.get(id) || 0, next = desired.get(id) || 0;
    if (old === next) continue;
    if (next === 0) result.delete(id);
    else {
      const quantity = Math.min(99, Math.max(0, (result.get(id) || 0) + next - old));
      if (quantity) result.set(id, quantity); else result.delete(id);
    }
  }
  return [...result].map(([productId, quantity]) => ({ productId, quantity }));
}

export function validCartLines(value: unknown, productIds: Set<string>): CartLine[] {
  if (!Array.isArray(value)) return [];
  const quantities = new Map<string, number>();
  for (const item of value) {
    if (!item || typeof item !== "object" || typeof item.productId !== "string" || !productIds.has(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) continue;
    quantities.set(item.productId, Math.min(99, (quantities.get(item.productId) || 0) + item.quantity));
  }
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}
