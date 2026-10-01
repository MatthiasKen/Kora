import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { emailOutbox } from "@/db/schema";
import { receiptFor } from "./order-service";
import { orderEmail } from "./email-template";
import { mailgunStatus, sendMailgunEmail } from "./mailgun-client";
import { emailedTrackingUrl } from "./tracking-access";
export async function dispatchOrderEmail(db: Database, orderId: string) {
  if (!mailgunStatus().configured) return false;
  const now = new Date();
  const [job] = await db
    .update(emailOutbox)
    .set({
      leaseUntil: new Date(now.getTime() + 5 * 60 * 1000),
      attempts: sql`${emailOutbox.attempts} + 1`,
    })
    .where(
      and(
        eq(emailOutbox.orderId, orderId),
        isNull(emailOutbox.sentAt),
        or(isNull(emailOutbox.leaseUntil), lt(emailOutbox.leaseUntil, now)),
      ),
    )
    .returning();
  if (!job) return false;
  try {
    const receipt = await receiptFor(db, orderId);
    const content = orderEmail(receipt, emailedTrackingUrl(receipt));
    await sendMailgunEmail({ to: receipt.shipping.email, content, messageKey: receipt.reference, tag: "order-confirmation" });
    await db
      .update(emailOutbox)
      .set({ sentAt: new Date(), leaseUntil: null, lastError: null })
      .where(eq(emailOutbox.id, job.id));
    return true;
  } catch (e) {
    await db
      .update(emailOutbox)
      .set({
        leaseUntil: new Date(
          Date.now() + Math.min(60, 2 ** Math.min(job.attempts, 6)) * 60000,
        ),
        lastError:
          e instanceof Error
            ? e.message.slice(0, 200)
            : "Email delivery failed",
      })
      .where(eq(emailOutbox.id, job.id));
    return false;
  }
}
export async function retryEmails(db: Database) {
  const pending = await db
    .select()
    .from(emailOutbox)
    .where(
      and(
        isNull(emailOutbox.sentAt),
        or(
          isNull(emailOutbox.leaseUntil),
          lt(emailOutbox.leaseUntil, new Date()),
        ),
      ),
    )
    .limit(20);
  let sent = 0;
  for (const row of pending)
    if (await dispatchOrderEmail(db, row.orderId)) sent++;
  return { processed: pending.length, sent };
}
