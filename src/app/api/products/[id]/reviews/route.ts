import { getDb } from "@/db";
import { currentUser } from "@/lib/auth";
import { assertLive, assertSameOrigin } from "@/lib/security";
import { getReviewPage, saveProductReview } from "@/lib/review-service";
import { AppError, errorResponse, fieldError } from "@/lib/errors";
import { readJson } from "@/lib/request-body";
import { reviewSchema } from "@/lib/validation";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    assertLive();
    const { id } = await context.params;
    if (id.length > 120) throw new AppError("Product not found.", 404);
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") || 1);
    const sort = url.searchParams.get("sort") || "recent";
    if (!Number.isInteger(page) || page < 1 || page > 100 || !["recent", "highest", "lowest"].includes(sort))
      throw new AppError("Invalid review filters.");
    const user = await currentUser();
    return Response.json(await getReviewPage(getDb(), id, user?.id ?? null, page, sort), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return errorResponse(e); }
}
export async function POST(request: Request, context: Context) {
  try {
    assertLive(); assertSameOrigin(request);
    const user = await currentUser();
    if (!user) throw new AppError("Sign in to review your purchase.", 401);
    const { id } = await context.params;
    const parsed = reviewSchema.safeParse(await readJson(request));
    if (!parsed.success) throw fieldError(parsed.error.issues);
    const db = getDb();
    await saveProductReview(db, id, user.id, parsed.data);
    return Response.json(await getReviewPage(db, id, user.id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return errorResponse(e); }
}
