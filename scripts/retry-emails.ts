import { config } from "dotenv";
config({ path: ".env.local" });
const { getDb } = await import("../src/db");
const { retryEmails } = await import("../src/lib/mailgun");
const { releaseExpiredOrders } = await import("../src/lib/order-service");
const db = getDb();
try {
  console.log({
    expired: await releaseExpiredOrders(db),
    ...(await retryEmails(db)),
  });
} finally {
  await db.$client.end();
}
