import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { carts, cartItems, products } from "@/db/schema";
import type { CartLine } from "./types";
import { mergeCartLines } from "./utils";
import { AppError } from "./errors";

export function assertCartOwner(expectedUserId: string | null, actualUserId: string | null) {
  if (expectedUserId !== actualUserId)
    throw new AppError("Your sign-in changed. Refresh your bag before making changes.", 409);
}

export async function ensureAccountCart(
  db: Database,
  userId: string,
  guestHash: string | null,
) {
  return db.transaction(async (tx) => {
    await tx.insert(carts).values({ userId }).onConflictDoNothing();
    const [cart] = await tx
      .select()
      .from(carts)
      .where(eq(carts.userId, userId))
      .for("update");
    if (guestHash) {
      const [guest] = await tx
        .select()
        .from(carts)
        .where(and(eq(carts.sessionHash, guestHash), isNull(carts.userId)))
        .for("update");
      if (guest && !guest.mergedInto) {
        const existing = await tx
          .select()
          .from(cartItems)
          .where(eq(cartItems.cartId, cart.id));
        const incoming = await tx
          .select()
          .from(cartItems)
          .where(eq(cartItems.cartId, guest.id));
        // Legacy logout snapshots belonged to an account. Never transfer that
        // private copy to a different account during an upgrade.
        const publicIncoming = guest.snapshotUserId && guest.snapshotUserId !== userId ? [] : incoming;
        const merged = mergeCartLines(
          existing,
          publicIncoming,
          guest.snapshotUserId === userId ? guest.snapshot : [],
        );
        const inventory = merged.length
          ? await tx
              .select()
              .from(products)
              .where(
                inArray(
                  products.id,
                  merged.map((i) => i.productId),
                ),
              )
          : [];
        const available = new Map(
          inventory.map((p) => [p.id, Math.max(0, p.stock - p.reserved)]),
        );
        const valid = merged
          .map((item) => ({
            ...item,
            quantity: Math.min(
              item.quantity,
              available.get(item.productId) ?? 0,
            ),
          }))
          .filter((item) => item.quantity > 0);
        await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));
        if (valid.length)
          await tx
            .insert(cartItems)
            .values(valid.map((item) => ({ ...item, cartId: cart.id })));
        await tx.delete(cartItems).where(eq(cartItems.cartId, guest.id));
        await tx
          .update(carts)
          .set({
            mergedInto: cart.id,
            snapshot: [],
            snapshotUserId: null,
            revision: sql`${carts.revision} + 1`,
          })
          .where(eq(carts.id, guest.id));
        await tx
          .update(carts)
          .set({ revision: sql`${carts.revision} + 1`, updatedAt: new Date() })
          .where(eq(carts.id, cart.id));
      }
    }
    const [latest] = await tx.select().from(carts).where(eq(carts.id, cart.id));
    return latest;
  });
}
export async function readCart(db: Database, cartId: string) {
  const [cart] = await db.select().from(carts).where(eq(carts.id, cartId));
  const items = await db
    .select({ productId: cartItems.productId, quantity: cartItems.quantity })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId))
    .orderBy(asc(cartItems.productId));
  return { items, revision: cart.revision };
}
export async function replaceCart(
  db: Database,
  cartId: string,
  items: CartLine[],
  revision: number,
) {
  return db.transaction(async (tx) => {
    const [cart] = await tx
      .select()
      .from(carts)
      .where(eq(carts.id, cartId))
      .for("update");
    if (cart.revision !== revision)
      throw new AppError(
        "Your bag changed in another tab. Please reload the latest bag.",
        409,
        { revision: "conflict" },
      );
    if (items.length) {
      const inventory = await tx
        .select()
        .from(products)
        .where(
          inArray(
            products.id,
            items.map((i) => i.productId),
          ),
        );
      const map = new Map(inventory.map((p) => [p.id, p]));
      for (const item of items) {
        const p = map.get(item.productId);
        if (!p)
          throw new AppError("An item in your bag is no longer available.");
        if (item.quantity > p.stock - p.reserved)
          throw new AppError(
            `Only ${Math.max(0, p.stock - p.reserved)} ${p.title} available. Please update your bag.`,
            409,
          );
      }
    }
    await tx.delete(cartItems).where(eq(cartItems.cartId, cartId));
    if (items.length)
      await tx
        .insert(cartItems)
        .values(items.map((item) => ({ ...item, cartId })));
    await tx
      .update(carts)
      .set({ revision: cart.revision + 1, updatedAt: new Date() })
      .where(eq(carts.id, cartId));
    return { items, revision: cart.revision + 1 };
  });
}
export async function startGuestCartAfterLogout(
  db: Database,
  cartId: string,
  userId: string,
  sessionHash: string,
) {
  return db.transaction(async (tx) => {
    const [account] = await tx.select().from(carts).where(and(eq(carts.id, cartId), eq(carts.userId, userId))).for("update");
    if (!account) throw new AppError("This shopping bag belongs to another account.", 403);
    // Keep the account bag in the database. Logged-out visitors get a new,
    // empty guest bag; selections made here can merge on their next sign-in.
    await tx.insert(carts).values({ sessionHash });
    return { items: [] as CartLine[], revision: 0 };
  });
}
