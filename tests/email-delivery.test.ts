import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mailgunStatus, sendMailgunEmail, mailgunDelivery, deliveryFromEvents } from "../src/lib/mailgun-client";
import { emailTestAllowed } from "../src/lib/email-test-policy";
import { orderEmail } from "../src/lib/email-template";
import { sampleReceipt } from "../src/lib/test-receipt";

describe("Protected Mailgun testing", { concurrency: false }, () => {
  const keys = ["MAILGUN_API_KEY", "MAILGUN_DOMAIN", "MAILGUN_FROM", "MAILGUN_API_BASE_URL"];
  let saved: (string | undefined)[];
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    saved = keys.map(key => process.env[key]);
    process.env.MAILGUN_API_KEY = "test-server-key";
    process.env.MAILGUN_DOMAIN = "mg.example.com";
    process.env.MAILGUN_FROM = "Kora <orders@mg.example.com>";
    process.env.MAILGUN_API_BASE_URL = "https://api.eu.mailgun.net";
  });
  afterEach(() => { keys.forEach((key, i) => { if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i]; }); globalThis.fetch = originalFetch; });
  it("requires a configured owner and verified identity, ignoring platform headers on other hosts", () => {
    const policy = { ownerEmail: "owner@example.com", appUrl: "https://store.chatgpt.site", platformId: "site-user-id", platformEmail: "owner@example.com" };
    assert.equal(emailTestAllowed(policy), true);
    assert.equal(emailTestAllowed({ ...policy, ownerEmail: undefined }), false);
    assert.equal(emailTestAllowed({ ...policy, platformId: null }), false);
    assert.equal(emailTestAllowed({ ...policy, platformEmail: "other@example.com" }), false);
    assert.equal(emailTestAllowed({ ...policy, appUrl: "https://store.example.com" }), false);
    assert.equal(emailTestAllowed({ ...policy, appUrl: "https://store.example.com", accountEmail: "owner@example.com" }), true);
  });
  it("refuses unconfigured sends and unapproved API origins without a network request", async () => {
    let requested = false;
    globalThis.fetch = async () => { requested = true; throw new Error("Unexpected request"); };
    delete process.env.MAILGUN_API_KEY;
    assert.equal(mailgunStatus().configured, false);
    const input = { to: "owner@example.com", content: orderEmail(sampleReceipt()), messageKey: "TEST", tag: "delivery-test" as const };
    await assert.rejects(sendMailgunEmail(input), /not configured/);
    process.env.MAILGUN_API_KEY = "test-server-key";
    process.env.MAILGUN_API_BASE_URL = "https://untrusted.example.com";
    await assert.rejects(sendMailgunEmail(input), /not configured/);
    assert.equal(requested, false);
  });
  it("sends escaped HTML and plain text through the correct region without claiming delivery", async () => {
    const content = orderEmail(sampleReceipt("owner@example.com", "<script>Customer</script>", "TEST"));
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), "https://api.eu.mailgun.net/v3/mg.example.com/messages");
      assert.equal(init?.method, "POST");
      const body = init?.body as FormData;
      assert.equal(body.get("to"), "owner@example.com");
      assert.equal(body.get("o:tag"), "delivery-test");
      assert.match(String(body.get("html")), /SAMPLE RECEIPT/);
      assert.match(String(body.get("html")), /&lt;script&gt;/);
      assert.match(String(body.get("text")), /No payment was taken/);
      assert.match(String(body.get("text")), /₦54,500/);
      assert.ok(!String(body.get("text")).includes("Total paid:"));
      return Response.json({ id: "<message@mg.example.com>" });
    };
    assert.deepEqual(await sendMailgunEmail({ to: "owner@example.com", content, messageKey: "TEST", tag: "delivery-test" }), { messageId: "<message@mg.example.com>", status: "accepted" });
  });
  it("reports provider rejection instead of success", async () => {
    globalThis.fetch = async () => new Response("Unauthorized", { status: 401 });
    await assert.rejects(sendMailgunEmail({ to: "owner@example.com", content: orderEmail(sampleReceipt()), messageKey: "TEST", tag: "delivery-test" }), /HTTP 401/);
  });
  it("queries events for the exact message and recipient", async () => {
    globalThis.fetch = async input => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v3/mg.example.com/events");
      assert.equal(url.searchParams.get("message-id"), "<message@mg.example.com>");
      assert.equal(url.searchParams.get("recipient"), "owner@example.com");
      return Response.json({ items: [{ event: "delivered", recipient: "owner@example.com", timestamp: 100, message: { headers: { "message-id": "message@mg.example.com" } } }] });
    };
    assert.equal((await mailgunDelivery("<message@mg.example.com>", "owner@example.com")).status, "delivered");
  });
  it("distinguishes queued, delayed, delivered and permanently failed events", () => {
    const check = (event: object[]) => deliveryFromEvents(event, "message", "owner@example.com");
    const base = { recipient: "owner@example.com", timestamp: 100 };
    assert.equal(check([]).status, "pending");
    assert.equal(check([{ ...base, event: "accepted" }]).status, "accepted");
    assert.equal(check([{ ...base, event: "failed", severity: "temporary" }]).temporaryFailure, true);
    assert.equal(check([{ ...base, event: "failed", severity: "permanent" }]).status, "failed");
    assert.equal(check([{ ...base, event: "accepted", timestamp: 99 }, { ...base, event: "delivered" }]).status, "delivered");
    assert.equal(check([{ ...base, event: "delivered", recipient: "someone@example.com" }]).status, "pending");
    assert.equal(check([{ ...base, event: "delivered", message: { headers: { "message-id": "other-message" } } }]).status, "pending");
  });
});
