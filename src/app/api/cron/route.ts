import { getDb } from "@/db";
import { safeEqual, assertLive } from "@/lib/security";
import { releaseExpiredOrders } from "@/lib/order-service";
import { retryEmails } from "@/lib/mailgun";
import { errorResponse } from "@/lib/errors";
export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    !safeEqual(
      request.headers.get("authorization") || "",
      `Bearer ${process.env.CRON_SECRET}`,
    )
  )
    return new Response("Unauthorized", { status: 401 });
  try {
    assertLive();
    const db = getDb();
    return Response.json({
      expired: await releaseExpiredOrders(db),
      ...(await retryEmails(db)),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
