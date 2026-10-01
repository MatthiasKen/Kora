import { z } from "zod";
import { getDb } from "@/db";
import { assertLive, assertSameOrigin } from "@/lib/security";
import { requireStoreOwner } from "@/lib/store-owner";
import { updateDelivery } from "@/lib/tracking-service";
import { deliveryUpdateSchema } from "@/lib/validation";
import { readJson } from "@/lib/request-body";
import { AppError, errorResponse, fieldError } from "@/lib/errors";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const owner = await requireStoreOwner();
    assertLive(); assertSameOrigin(request);
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) throw new AppError("Order not found.", 404);
    const parsed = deliveryUpdateSchema.safeParse(await readJson(request));
    if (!parsed.success) throw fieldError(parsed.error.issues);
    return Response.json(await updateDelivery(getDb(), id, owner.email, parsed.data), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return errorResponse(e); }
}
