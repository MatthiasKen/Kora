import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { assertLive, tokenHash, safeEqual } from "@/lib/security";
import { validTrackingAccess } from "@/lib/tracking-access";
import { trackingFor } from "@/lib/tracking-service";
import { AppError, errorResponse } from "@/lib/errors";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ reference: string }> }) {
  try {
    assertLive();
    const { reference } = await context.params;
    if (!/^KORA_[a-f0-9]{24}$/.test(reference)) throw new AppError("Order not found.", 404);
    const db = getDb();
    const [order] = await db.select().from(orders).where(eq(orders.paystackReference, reference));
    const user = await currentUser();
    const cookie = (await cookies()).get("kora_receipt")?.value;
    const linkToken = new URL(request.url).searchParams.get("access");
    if (!order || !(
      (user && order.userId === user.id) ||
      (cookie && safeEqual(tokenHash(cookie), order.accessHash)) ||
      (order.paidAt && validTrackingAccess(linkToken, reference, order.id, process.env.NEXTAUTH_SECRET || ""))
    )) throw new AppError("Order not found. Sign in with the account used at checkout, or open the tracking link in your confirmation email.", 404);
    return Response.json(await trackingFor(db, order.id), { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (e) { return errorResponse(e); }
}
