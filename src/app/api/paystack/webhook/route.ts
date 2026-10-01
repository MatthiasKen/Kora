import { getDb } from "@/db";
import { validPaystackSignature, assertLive } from "@/lib/security";
import { finalizePayment } from "@/lib/order-service";
import { dispatchOrderEmail } from "@/lib/mailgun";
import { verifyPayment } from "@/lib/paystack";
import { errorResponse } from "@/lib/errors";
import { readBody } from "@/lib/request-body";
export async function POST(request: Request) {
  try {
    assertLive();
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return new Response("Payments unavailable", { status: 503 });
    const raw = await readBody(request, 250000);
    if (
      raw.length > 250000 ||
      !validPaystackSignature(
        raw,
        request.headers.get("x-paystack-signature"),
        secret,
      )
    )
      return new Response("Invalid signature", { status: 401 });
    const event = JSON.parse(raw);
    if (event.event !== "charge.success")
      return Response.json({ received: true });
    if (
      typeof event.data?.reference !== "string" ||
      !/^KORA_[a-f0-9]{24}$/.test(event.data.reference)
    )
      return Response.json({ received: true });
    const payment = await verifyPayment(event.data.reference);
    const db = getDb();
    const order = await finalizePayment(db, payment);
    await dispatchOrderEmail(db, order.id);
    return Response.json({ received: true });
  } catch (e) {
    return errorResponse(e);
  }
}
