import { AppError } from "./errors";

const regions = ["https://api.mailgun.net", "https://api.eu.mailgun.net"];
export function mailgunStatus() {
  const missing = ["MAILGUN_API_KEY", "MAILGUN_DOMAIN", "MAILGUN_FROM"].filter(key => !process.env[key]?.trim());
  const base = process.env.MAILGUN_API_BASE_URL?.trim() || regions[0];
  const validRegion = regions.includes(base);
  return { configured: missing.length === 0 && validRegion, missing, validRegion, region: base === regions[1] ? "EU" : "US" };
}
function mailgunConfig() {
  if (!mailgunStatus().configured)
    throw new AppError("Mailgun is not configured. Add the sending domain, sender and server API key first.", 503);
  const domain = process.env.MAILGUN_DOMAIN!.trim();
  const from = process.env.MAILGUN_FROM!.trim();
  if (!/^[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i.test(domain) || /[\r\n]/.test(from))
    throw new AppError("Check your Mailgun sending domain and sender address.", 503);
  return {
    domain, from, base: process.env.MAILGUN_API_BASE_URL?.trim() || regions[0],
    authorization: `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY!.trim()}`).toString("base64")}`,
  };
}
export async function sendMailgunEmail(input: {
  to: string;
  content: { subject: string; html: string; text: string };
  messageKey: string;
  tag: "order-confirmation" | "delivery-test";
}) {
  const config = mailgunConfig();
  const body = new FormData();
  body.set("from", config.from);
  body.set("to", input.to);
  body.set("subject", input.content.subject);
  body.set("html", input.content.html);
  body.set("text", input.content.text);
  body.set("h:Message-Id", `<${input.messageKey}@${config.domain}>`);
  body.set("o:tag", input.tag);
  body.set("o:tracking", "no");
  const response = await fetch(`${config.base}/v3/${encodeURIComponent(config.domain)}/messages`, {
    method: "POST", headers: { Authorization: config.authorization }, body,
    redirect: "error", signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new AppError(`Mailgun rejected the send (HTTP ${response.status}). Check the API key, domain and authorized recipients.`, 502);
  const data = await response.json() as { id?: unknown };
  if (typeof data.id !== "string" || !data.id)
    throw new AppError("Mailgun did not return a message ID. Check its logs before sending again.", 502);
  return { messageId: data.id, status: "accepted" as const };
}

export type DeliveryStatus = { status: "pending" | "accepted" | "delivered" | "failed"; at: string | null; temporaryFailure: boolean };
type MailgunEvent = { event?: string; recipient?: string; severity?: string; timestamp?: number; message?: { headers?: { "message-id"?: string } } };
export function deliveryFromEvents(events: MailgunEvent[], messageId: string, recipient: string): DeliveryStatus {
  const normalId = (id: string) => id.replace(/^<|>$/g, "");
  const matching = events.filter(event =>
    event.recipient?.toLowerCase() === recipient.toLowerCase() &&
    (!event.message?.headers?.["message-id"] || normalId(event.message.headers["message-id"]) === normalId(messageId)),
  ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const terminal = matching.find(event => event.event === "delivered" || (event.event === "failed" && event.severity === "permanent"));
  const latest = terminal || matching[0];
  const status = terminal ? terminal.event === "delivered" ? "delivered" : "failed" : latest?.event === "accepted" ? "accepted" : "pending";
  return { status, at: latest?.timestamp && Number.isFinite(latest.timestamp) ? new Date(latest.timestamp * 1000).toISOString() : null, temporaryFailure: !terminal && latest?.event === "failed" && latest.severity === "temporary" };
}
export async function mailgunDelivery(messageId: string, recipient: string): Promise<DeliveryStatus> {
  const config = mailgunConfig();
  const url = new URL(`${config.base}/v3/${encodeURIComponent(config.domain)}/events`);
  url.searchParams.set("message-id", messageId);
  url.searchParams.set("recipient", recipient);
  url.searchParams.set("limit", "25");
  const response = await fetch(url, { headers: { Authorization: config.authorization }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new AppError(`Mailgun delivery status is unavailable (HTTP ${response.status}). Check the API key's event permissions.`, 502);
  const data = await response.json() as { items?: MailgunEvent[] };
  if (!Array.isArray(data.items)) throw new AppError("Mailgun returned an unexpected event response.", 502);
  return deliveryFromEvents(data.items, messageId, recipient);
}
