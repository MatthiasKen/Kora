import { randomUUID } from "node:crypto";
import { z } from "zod";
import { emailTestOwner } from "@/lib/email-test-access";
import { AppError, errorResponse, fieldError } from "@/lib/errors";
import { readJson } from "@/lib/request-body";
import { emailRecipientSchema } from "@/lib/validation";
import { assertSameOrigin } from "@/lib/security";
import {
  mailgunStatus,
  mailgunDelivery,
  sendMailgunEmail,
} from "@/lib/mailgun-client";
import { sampleReceipt } from "@/lib/test-receipt";
import { orderEmail } from "@/lib/email-template";

export const dynamic = "force-dynamic";
async function requireOwner() {
  if (!(await emailTestOwner()))
    throw new AppError(
      "Email testing is available only to the store owner.",
      403,
    );
}
export async function POST(request: Request) {
  try {
    await requireOwner();
    assertSameOrigin(request);
    const parsed = emailRecipientSchema.safeParse(await readJson(request));
    if (!parsed.success) throw fieldError(parsed.error.issues);
    const receipt = sampleReceipt(
      parsed.data.email,
      parsed.data.name,
      randomUUID(),
    );
    const result = await sendMailgunEmail({
      to: parsed.data.email,
      content: orderEmail(receipt),
      messageKey: receipt.reference,
      tag: "delivery-test",
    });
    return Response.json(
      { ...result, recipient: parsed.data.email, reference: receipt.reference },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function GET(request: Request) {
  try {
    await requireOwner();
    const query = new URL(request.url).searchParams;
    if (!query.has("messageId"))
      return Response.json(mailgunStatus(), {
        headers: { "Cache-Control": "no-store" },
      });
    const parsed = z
      .object({
        messageId: z
          .string()
          .min(1)
          .max(500)
          .regex(/^[^\r\n]+$/),
        recipient: z.email().max(254),
      })
      .safeParse({
        messageId: query.get("messageId"),
        recipient: query.get("recipient"),
      });
    if (!parsed.success)
      throw new AppError("Please check the message ID and recipient.");
    return Response.json(
      await mailgunDelivery(parsed.data.messageId, parsed.data.recipient),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
