"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { useFieldValidation } from "./use-field-validation";
import { emailRecipientSchema } from "@/lib/validation";
import { orderEmail } from "@/lib/email-template";
import { sampleReceipt } from "@/lib/test-receipt";
import type { mailgunStatus, DeliveryStatus } from "@/lib/mailgun-client";

type TestSend = {
  messageId: string;
  recipient: string;
  reference: string;
  status: "accepted";
};
export function EmailTestPage({
  configuration: initial,
  owner,
  preview: initialPreview,
}: {
  configuration: ReturnType<typeof mailgunStatus>;
  owner: { email: string; name: string };
  preview: string;
}) {
  const [configuration, setConfiguration] = useState(initial);
  const [name, setName] = useState(owner.name);
  const [email, setEmail] = useState(owner.email);
  const [preview, setPreview] = useState(initialPreview);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<TestSend | null>(null);
  const [delivery, setDelivery] = useState<DeliveryStatus | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const fields = useFieldValidation(emailRecipientSchema, { name, email });
  const sending = useRef(false);
  function updatePreview(nextName: string, nextEmail: string) {
    setPreview(
      orderEmail(sampleReceipt(nextEmail, nextName || "Kora customer")).html,
    );
  }
  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || !configuration.configured) return;
    const recipient = fields.validate();
    if (!recipient.success) {
      document
        .getElementById(
          recipient.error.issues[0].path[0] === "name"
            ? "test-email-name"
            : "test-email-address",
        )
        ?.focus();
      return;
    }
    sending.current = true;
    setSent(null);
    setDelivery(null);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recipient.data),
        signal: AbortSignal.timeout(25000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "The test email could not be sent.");
      if (
        data.status !== "accepted" ||
        typeof data.messageId !== "string" ||
        !data.messageId ||
        typeof data.recipient !== "string"
      )
        throw new Error(
          "Sending could not be confirmed. Check Mailgun before retrying.",
        );
      setSent(data);
      setDelivery({ status: "accepted", at: null, temporaryFailure: false });
      setSuccessOpen(true);
    } catch (e) {
      setError(
        e instanceof Error && e.name === "TimeoutError"
          ? "The request timed out. Check Mailgun before retrying to avoid sending twice."
          : e instanceof Error
            ? e.message
            : "The test email could not be sent.",
      );
    } finally {
      setBusy(false);
      sending.current = false;
    }
  }
  async function check() {
    if (!sent || checking) return;
    setChecking(true);
    setError("");
    try {
      const query = new URLSearchParams({
        messageId: sent.messageId,
        recipient: sent.recipient,
      });
      const response = await fetch(`/api/email/test?${query}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Delivery status is unavailable.");
      setDelivery(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Delivery status is unavailable.",
      );
    } finally {
      setChecking(false);
    }
  }
  async function refreshConfiguration() {
    setChecking(true);
    setError("");
    try {
      const response = await fetch("/api/email/test", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Configuration could not be checked.");
      setConfiguration(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Configuration could not be checked.",
      );
    } finally {
      setChecking(false);
    }
  }
  const status = delivery?.status;
  return (
    <div className="page-width email-test-page">
      <div className="breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/account">Your account</Link>
        <span>/</span>
        <span>Email testing</span>
      </div>
      <div className="email-test-heading">
        <div>
          <p className="eyebrow">STORE OWNER TOOLS</p>
          <h1>
            Test email <em>delivery.</em>
          </h1>
          <p>Send a sample order confirmation and see where it lands.</p>
        </div>
        <span className="email-owner-badge">
          <ShieldCheck size={16} /> Owner only
        </span>
      </div>
      <div className="email-test-layout">
        <div className="email-test-controls">
          <section
            className={`email-connection ${configuration.configured ? "connected" : ""}`}
            aria-label="Mailgun connection"
          >
            <Mail size={22} strokeWidth={1.4} />
            <div>
              <h2>
                {configuration.configured
                  ? "Mailgun is configured."
                  : "Connect Mailgun to send."}
              </h2>
              <p>
                {configuration.configured
                  ? `Ready to send through the ${configuration.region} region.`
                  : "You can preview your receipt while email sending is being set up."}
              </p>
            </div>
          </section>
          {!configuration.configured && (
            <section className="email-setup">
              <h2>Three steps to your first email.</h2>
              <ol>
                <li>Verify your sending domain in Mailgun.</li>
                <li>
                  Add <code>MAILGUN_API_KEY</code>, <code>MAILGUN_DOMAIN</code>{" "}
                  and <code>MAILGUN_FROM</code> in your hosting environment
                  settings. Keep the API key in secret storage.
                </li>
                <li>
                  Redeploy, then send a test to your email below. Mailgun
                  sandbox domains require an authorized recipient.
                </li>
              </ol>
              {!configuration.validRegion && (
                <p className="checkout-error">
                  Use the US or EU Mailgun API URL.
                </p>
              )}
              <div className="email-setup-actions">
                <a
                  href="https://app.mailgun.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Mailgun <ExternalLink size={13} />
                </a>
                <button
                  type="button"
                  onClick={refreshConfiguration}
                  disabled={checking}
                >
                  <RefreshCw
                    size={13}
                    className={checking ? "animate-spin" : ""}
                  />{" "}
                  Check connection
                </button>
              </div>
            </section>
          )}
          <form
            noValidate
            className="email-send-form"
            onSubmit={send}
            aria-busy={busy}
          >
            <h2>Send a sample receipt.</h2>
            <p>
              Choose a recipient you can check. This sends a real test email,
              without an order or payment.
            </p>
            <label htmlFor="test-email-name">Recipient name</label>
            <input
              id="test-email-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                updatePreview(e.target.value, email);
              }}
              onBlur={() => fields.touch("name")}
              aria-invalid={!!fields.errors.name}
              aria-describedby={
                fields.errors.name ? "test-name-error" : undefined
              }
              disabled={busy}
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
            />
            {fields.errors.name && (
              <small id="test-name-error" className="field-error">
                {fields.errors.name}
              </small>
            )}
            <label htmlFor="test-email-address">Recipient email</label>
            <input
              id="test-email-address"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                updatePreview(name, e.target.value);
              }}
              onBlur={() => fields.touch("email")}
              aria-invalid={!!fields.errors.email}
              aria-describedby={
                fields.errors.email ? "test-email-error" : undefined
              }
              disabled={busy}
              required
              maxLength={254}
              autoComplete="email"
            />
            {fields.errors.email && (
              <small id="test-email-error" className="field-error">
                {fields.errors.email}
              </small>
            )}
            <Button
              className="w-full mt-5"
              type="submit"
              disabled={!configuration.configured || busy || checking}
            >
              {busy ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Mail size={17} />
              )}
              {busy ? "Sending test email…" : "Send test email"}
            </Button>
            {busy && (
              <p className="sending-status" role="status">
                Sending your receipt. This may take a moment.
              </p>
            )}
            {!configuration.configured && (
              <small className="email-disabled-note">
                Sending will be available once Mailgun is configured.
              </small>
            )}
          </form>
          {error && (
            <div className="checkout-error" role="alert">
              {error}
            </div>
          )}
          {sent && (
            <section
              className={`email-delivery-status ${status}`}
              aria-live="polite"
            >
              {status === "delivered" ? (
                <CheckCircle2 size={24} />
              ) : status === "failed" ? (
                <XCircle size={24} />
              ) : (
                <CircleDot size={24} />
              )}
              <h2>
                {status === "delivered"
                  ? "Received by the mail server."
                  : status === "failed"
                    ? "Delivery failed."
                    : status === "accepted"
                      ? "Mailgun accepted your email."
                      : "Waiting for delivery events."}
              </h2>
              <p>
                {status === "delivered"
                  ? "The recipient's mail server accepted the email. Check the inbox and spam folder to confirm where it arrived."
                  : status === "failed"
                    ? "Mailgun reported a permanent failure. Check the address and Mailgun logs before trying again."
                    : delivery?.temporaryFailure
                      ? "Mailgun reported a temporary delivery issue and may retry. Check again shortly."
                      : "Your email is queued. Check its delivery status in a few moments."}
              </p>
              <dl>
                <dt>Recipient</dt>
                <dd>{sent.recipient}</dd>
                <dt>Message ID</dt>
                <dd>{sent.messageId}</dd>
                {delivery?.at && (
                  <>
                    <dt>Last event</dt>
                    <dd>
                      {new Date(delivery.at).toLocaleString("en-NG", {
                        timeZone: "Africa/Lagos",
                      })}{" "}
                      WAT
                    </dd>
                  </>
                )}
              </dl>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={check}
                disabled={checking || busy}
              >
                <RefreshCw
                  size={14}
                  className={checking ? "animate-spin" : ""}
                />
                {checking ? "Checking…" : "Check delivery status"}
              </Button>
            </section>
          )}
        </div>
        <section className="email-preview-panel">
          <div className="email-preview-heading">
            <div>
              <p className="eyebrow">WHAT YOUR CUSTOMER SEES</p>
              <h2>A receipt, with all the details.</h2>
            </div>
            <span>Sample</span>
          </div>
          <iframe
            title="Sample order confirmation email"
            sandbox=""
            srcDoc={preview}
            className="email-preview-frame"
          />
          <p className="email-preview-footnote">
            The live confirmation includes purchased items, discounts, payment
            details and the customer's delivery address.
          </p>
        </section>
      </div>
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="success-dialog">
          <div className="success-modal-mark">
            <CheckCircle2 size={34} />
          </div>
          <DialogTitle>Email sent.</DialogTitle>
          <DialogDescription>
            Mailgun accepted your test receipt and queued it for delivery. Check
            the recipient's inbox and spam folder, or use the delivery status
            below.
          </DialogDescription>
          <div className="success-email-recipient">
            <Mail size={16} className="inline mr-2" />
            {sent?.recipient}
          </div>
          <Button className="w-full" onClick={() => setSuccessOpen(false)}>
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
