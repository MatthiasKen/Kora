import { cookies } from "next/headers";
import { cartContext } from "@/lib/cart-context";
import { startGuestCartAfterLogout } from "@/lib/cart-service";
import {
  assertLive,
  assertSameOrigin,
  cookieOptions,
  secretToken,
  tokenHash,
} from "@/lib/security";
import { AppError, errorResponse } from "@/lib/errors";
export async function POST(request: Request) {
  try {
    assertLive();
    assertSameOrigin(request);
    const { db, cart, user } = await cartContext();
    if (!user) throw new AppError("Please sign in first.", 401);
    const token = secretToken();
    const result = await startGuestCartAfterLogout(
      db,
      cart.id,
      user.id,
      tokenHash(token),
    );
    (await cookies()).set("kora_bag", token, cookieOptions());
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
