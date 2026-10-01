import { desc, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { assertLive } from "@/lib/security";
import { requireStoreOwner } from "@/lib/store-owner";
import { receiptFor } from "@/lib/order-service";
import { errorResponse } from "@/lib/errors";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireStoreOwner(); assertLive();
    const db = getDb();
    const rows = await db.select({ id: orders.id }).from(orders)
      .where(inArray(orders.status, ["paid", "fulfillment_review"])).orderBy(desc(orders.createdAt)).limit(50);
    return Response.json(await Promise.all(rows.map(order => receiptFor(db, order.id))), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return errorResponse(e); }
}
