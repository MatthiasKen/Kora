import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { receiptFor } from "@/lib/order-service";
import { assertLive } from "@/lib/security";
import { AppError, errorResponse } from "@/lib/errors";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    assertLive();
    const user = await currentUser();
    if (!user) throw new AppError("Please sign in to view your orders.", 401);
    const db = getDb();
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, user.id))
      .orderBy(desc(orders.createdAt))
      .limit(50);
    return Response.json(
      await Promise.all(rows.map((o) => receiptFor(db, o.id))),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
