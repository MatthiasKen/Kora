import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { orders } from "@/db/schema";
import { cartContext } from "@/lib/cart-context";
import { checkoutSchema } from "@/lib/validation";
import { createPendingOrder, releaseExpiredOrders } from "@/lib/order-service";
import { initializePayment } from "@/lib/paystack";
import { appOrigin } from "@/lib/config";
import {
  assertLive,
  assertSameOrigin,
  cookieOptions,
  secretToken,
  tokenHash,
} from "@/lib/security";
import { AppError, errorResponse, fieldError } from "@/lib/errors";
import { readJson } from "@/lib/request-body";
export async function POST(request: Request) {
  try {
    assertLive();
    assertSameOrigin(request);
    if (!process.env.PAYSTACK_SECRET_KEY)
      throw new AppError("Payments are not configured yet.", 503);
    const result = checkoutSchema.safeParse(await readJson(request));
    if (!result.success) throw fieldError(result.error.issues);
    const { db, cart, user } = await cartContext();
    await releaseExpiredOrders(db);
    const jar = await cookies();
    let token = jar.get("kora_receipt")?.value;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) token = secretToken();
    const order = await createPendingOrder(db, {
      cartId: cart.id,
      userId: user?.id ?? null,
      idempotencyKey: tokenHash(`${cart.id}:${result.data.idempotencyKey}`),
      accessHash: tokenHash(token),
      shipping: result.data.shipping,
      expectedTotalNaira: result.data.expectedTotalNaira,
    });
    jar.set("kora_receipt", token, cookieOptions());
    if (["paid", "fulfillment_review"].includes(order.status))
      return Response.json({
        authorizationUrl: `${appOrigin()}/checkout/success?reference=${order.paystackReference}`,
      });
    const authorizationUrl =
      order.authorizationUrl ||
      (await initializePayment(
        order.paystackReference,
        order.email,
        order.totalAmountNaira,
        `${appOrigin()}/checkout/success`,
      ));
    if (!order.authorizationUrl)
      await db
        .update(orders)
        .set({ authorizationUrl })
        .where(eq(orders.id, order.id));
    return Response.json({
      authorizationUrl,
      reference: order.paystackReference,
      totalNaira: order.totalAmountNaira,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
