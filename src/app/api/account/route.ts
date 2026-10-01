import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { shippingSchema } from "@/lib/validation";
import { assertLive, assertSameOrigin } from "@/lib/security";
import { AppError, errorResponse, fieldError } from "@/lib/errors";
import { readJson } from "@/lib/request-body";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    assertLive();
    const user = await currentUser();
    if (!user) throw new AppError("Please sign in.", 401);
    const [row] = await getDb()
      .select({
        name: users.name,
        email: users.email,
        shipping: users.shipping,
      })
      .from(users)
      .where(eq(users.id, user.id));
    return Response.json(row, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PUT(request: Request) {
  try {
    assertLive();
    assertSameOrigin(request);
    const user = await currentUser();
    if (!user) throw new AppError("Please sign in.", 401);
    const result = shippingSchema.safeParse(await readJson(request));
    if (!result.success) throw fieldError(result.error.issues);
    await getDb()
      .update(users)
      .set({ shipping: result.data, phone: result.data.phone })
      .where(eq(users.id, user.id));
    return Response.json({ saved: true });
  } catch (e) {
    return errorResponse(e);
  }
}
