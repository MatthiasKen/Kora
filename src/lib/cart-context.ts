import { cookies } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { carts } from "@/db/schema";
import { currentUser } from "./auth";
import { cookieOptions, secretToken, tokenHash } from "./security";
import { ensureAccountCart } from "./cart-service";
export async function cartContext() {
  const db = getDb();
  const jar = await cookies();
  const user = await currentUser();
  let token = jar.get("kora_bag")?.value;
  if (token && !/^[a-f0-9]{64}$/.test(token)) token = undefined;
  if (user)
    return {
      db,
      cart: await ensureAccountCart(
        db,
        user.id,
        token ? tokenHash(token) : null,
      ),
      user,
      created: false,
    };
  let cart = token
    ? (
        await db
          .select()
          .from(carts)
          .where(
            and(eq(carts.sessionHash, tokenHash(token)), isNull(carts.userId)),
          )
      )[0]
    : undefined;
  let created = false;
  if (!cart || cart.mergedInto || cart.snapshotUserId) {
    token = secretToken();
    created = true;
    [cart] = await db
      .insert(carts)
      .values({ sessionHash: tokenHash(token) })
      .returning();
    jar.set("kora_bag", token, cookieOptions());
  }
  return { db, cart, user: null, created };
}
