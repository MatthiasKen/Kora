import { z } from "zod";
import { cartContext } from "@/lib/cart-context";
import { assertCartOwner, readCart, replaceCart } from "@/lib/cart-service";
import { assertLive, assertSameOrigin } from "@/lib/security";
import { AppError, errorResponse } from "@/lib/errors";
import { readJson } from "@/lib/request-body";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    assertLive();
    const { db, cart, created, user } = await cartContext();
    return Response.json(
      { ...(await readCart(db, cart.id)), created, ownerId: user?.id ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
const schema = z
  .object({
    ownerId: z.string().min(1).max(254).nullable(),
    revision: z.number().int().min(0),
    items: z
      .array(
        z.object({
          productId: z.string().min(1).max(120),
          quantity: z.number().int().min(1).max(99),
        }),
      )
      .max(50),
  })
  .refine(
    (v) => new Set(v.items.map((i) => i.productId)).size === v.items.length,
    "Duplicate products are not allowed.",
  );
export async function PUT(request: Request) {
  try {
    assertLive();
    assertSameOrigin(request);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new AppError("Please check the items in your bag.");
    const { db, cart, user } = await cartContext();
    assertCartOwner(parsed.data.ownerId, user?.id ?? null);
    return Response.json(
      await replaceCart(db, cart.id, parsed.data.items, parsed.data.revision),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
