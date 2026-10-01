import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { assertLive, safeEqual, tokenHash } from "@/lib/security";
import { finalizePayment, receiptFor } from "@/lib/order-service";
import { verifyPayment } from "@/lib/paystack";
import { dispatchOrderEmail } from "@/lib/mailgun";
import { AppError, errorResponse } from "@/lib/errors";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ reference: string }> },
) {
  try {
    assertLive();
    const { reference } = await context.params;
    if (!/^KORA_[a-f0-9]{24}$/.test(reference))
      throw new AppError("Order not found.", 404);
    const db = getDb();
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.paystackReference, reference));
    const user = await currentUser();
    const token = (await cookies()).get("kora_receipt")?.value;
    if (
      !order ||
      (!(user && order.userId === user.id) &&
        !(token && safeEqual(tokenHash(token), order.accessHash)))
    )
      throw new AppError(
        "Order not found. Use the browser you paid from or sign in to your account.",
        404,
      );
    if (
      new URL(request.url).searchParams.get("verify") === "1" &&
      !["paid", "fulfillment_review"].includes(order.status)
    )
      await finalizePayment(db, await verifyPayment(reference));
    const receipt = await receiptFor(db, order.id);
    if (["paid", "fulfillment_review"].includes(receipt.status))
      await dispatchOrderEmail(db, order.id);
    return Response.json(receipt, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
