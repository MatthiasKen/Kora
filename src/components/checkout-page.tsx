"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CreditCard,
  Info,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "./store-provider";
import { Button } from "./ui/button";
import { ShippingFields } from "./shipping-fields";
import { useFieldValidation } from "./use-field-validation";
import { shippingSchema } from "@/lib/validation";
import { deliveryFee, effectivePrice, money } from "@/lib/utils";
import type { Receipt, ShippingAddress } from "@/lib/types";
export function CheckoutPage() {
  const {
    items,
    products,
    subtotal,
    count,
    user,
    hydrated,
    cartReady,
    cartError,
    deliveryState,
    setDeliveryState,
    setBagOpen,
    flushCart,
    config,
    completeDemoOrder,
  } = useStore();
  const router = useRouter();
  const [shipping, setShipping] = useState<ShippingAddress>({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "Lagos",
    notes: "",
  });
  const validationFields = useFieldValidation(shippingSchema, shipping);
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  const [serverError, setServerError] = useState("");
  const dirty = useRef(false);
  const idempotency = useRef("");
  const submitting = useRef(false);
  useEffect(() => {
    if (!dirty.current)
      setShipping((current) => ({
        ...current,
        state: deliveryState,
        fullName: user?.name || current.fullName,
        email: user?.email || current.email,
      }));
  }, [deliveryState, user?.name, user?.email]);
  useEffect(() => {
    if (!user) return;
    if (config.demo) {
      try {
        const saved = JSON.parse(
          localStorage.getItem(`kora-address-${user.id}`) || "null",
        );
        if (saved && !dirty.current) setShipping(saved);
      } catch {}
    } else {
      void fetch("/api/account")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.shipping && !dirty.current) setShipping(data.shipping);
        })
        .catch(() => {});
    }
  }, [user?.id, config.demo]);
  const fee = deliveryFee(subtotal, shipping.state);
  const total = subtotal + fee;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    const validation = validationFields.validate();
    setServerError("");
    if (!validation.success) {
      document
        .querySelector<HTMLElement>(
          `#shipping-${String(validation.error.issues[0].path[0])}`,
        )
        ?.focus();
      return;
    }
    submitting.current = true;
    setBusy(true);
    setDeliveryState(validation.data.state);
    try {
      await flushCart();
      if (remember && user) {
        if (config.demo)
          localStorage.setItem(
            `kora-address-${user.id}`,
            JSON.stringify(validation.data),
          );
        else {
          const saved = await fetch("/api/account", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(validation.data),
          });
          if (!saved.ok)
            toast.info(
              "We couldn't save your address for next time. You can still complete this order.",
            );
        }
      }
      if (config.demo) {
        const now = new Date().toISOString();
        const receipt: Receipt = {
          id: crypto.randomUUID(),
          reference: `DEMO_${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          status: "demo",
          shipping: validation.data,
          subtotalNaira: subtotal,
          shippingNaira: fee,
          totalNaira: total,
          createdAt: now,
          paidAt: null,
          demo: true,
          items: items.map((i) => {
            const p = products.find((p) => p.id === i.productId)!;
            const price = effectivePrice(p);
            return {
              productId: p.id,
              title: p.title,
              imageUrl: p.imageUrl,
              quantity: i.quantity,
              priceNaira: price,
              originalPriceNaira:
                p.originalPriceNaira && p.originalPriceNaira > price
                  ? p.originalPriceNaira
                  : null,
            };
          }),
        };
        completeDemoOrder(receipt);
        router.push(`/checkout/success?reference=${receipt.reference}`);
        return;
      }
      idempotency.current ||=
        sessionStorage.getItem("kora-checkout-id") || crypto.randomUUID();
      sessionStorage.setItem("kora-checkout-id", idempotency.current);
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipping: validation.data,
          idempotencyKey: idempotency.current,
          expectedTotalNaira: total,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          sessionStorage.removeItem("kora-checkout-id");
          idempotency.current = "";
        }
        throw new Error(
          data.error || "Couldn't start your payment. Please try again.",
        );
      }
      window.location.assign(data.authorizationUrl);
    } catch (e) {
      setServerError((e as Error).message);
      setBusy(false);
      submitting.current = false;
    }
  }
  if (!hydrated || !cartReady)
    return (
      <div className="page-width status-page">
        {!cartError && <Loader2 className="animate-spin mx-auto" />}
        <p className={cartError ? "field-error" : ""}>{cartError || "Getting your bag ready…"}</p>
        {cartError && <p>Use “Retry bag sync” above to reconnect your saved bag.</p>}
      </div>
    );
  if (!items.length)
    return (
      <div className="page-width status-page">
        <h1>A good find comes first.</h1>
        <p>Add something to your bag and we'll meet you here.</p>
        <Button asChild>
          <Link href="/shop">
            Explore the store <ArrowRight size={17} />
          </Link>
        </Button>
      </div>
    );
  return (
    <div className="page-width checkout-page">
      <div className="breadcrumb">
        <Link href="/shop">
          <ArrowLeft size={14} />
          Back to shopping
        </Link>
        <span>/</span>
        <span>Checkout</span>
      </div>
      <div className="checkout-title">
        <div>
          <p className="eyebrow">ONE STEP CLOSER</p>
          <h1>Good things are on their way.</h1>
        </div>
        <span>
          <LockKeyhole size={17} />
          Secure checkout
        </span>
      </div>
      {config.demo && (
        <div className="demo-notice">
          <Info size={18} />
          <div>
            <strong>You're exploring a demo store.</strong>
            <p>
              Try the full checkout experience. No money is charged and no email
              is sent.
            </p>
          </div>
        </div>
      )}
      {!config.demo && !config.paymentsEnabled && (
        <div className="demo-notice">
          <Info size={18} />
          <div>
            <strong>Checkout is being connected.</strong>
            <p>
              Payments will be available once the store completes its setup.
            </p>
          </div>
        </div>
      )}
      <form
        noValidate
        onSubmit={submit}
        className="checkout-layout"
        aria-busy={busy}
      >
        <div className="checkout-left">
          {!user && (
            <div className="checkout-signin">
              <span>Already part of the Kora family?</span>
              <Link href="/account?next=/checkout">
                Sign in for a smoother checkout <ArrowUpRightSmall />
              </Link>
            </div>
          )}
          <section className="checkout-card">
            <div className="step-heading">
              <span>1</span>
              <div>
                <h2>Your delivery details</h2>
                <p>Where should your good finds go?</p>
              </div>
            </div>
            <ShippingFields
              value={shipping}
              onChange={(value) => {
                dirty.current = true;
                setShipping(value);
              }}
              errors={validationFields.errors}
              onBlur={validationFields.touch}
            />
            {user && (
              <label className="remember-address">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Save this address for my next good find
              </label>
            )}
          </section>
          <section className="checkout-card payment-card">
            <div className="step-heading">
              <span>2</span>
              <div>
                <h2>A safe way to pay</h2>
                <p>
                  {config.demo
                    ? "This preview uses a simulated checkout."
                    : "Choose your preferred method securely on Paystack."}
                </p>
              </div>
            </div>
            <div className="payment-methods">
              <span>
                <CreditCard size={21} />
                Debit card
              </span>
              <span>
                <Banknote size={21} />
                Bank transfer
              </span>
              <span>
                <Smartphone size={21} />
                USSD
              </span>
            </div>
            <div className="payment-explainer">
              <ShieldCheck size={19} />
              <p>
                {config.demo
                  ? "Your sample order stays in this browser. Connect Paystack to accept real payments."
                  : "Your card details are handled by Paystack. We never see or store them. We'll confirm your order after your payment is verified."}
              </p>
            </div>
          </section>
        </div>
        <aside className="order-summary">
          <div className="summary-heading">
            <h2>
              Your good finds <span>({count})</span>
            </h2>
            <button type="button" onClick={() => setBagOpen(true)}>
              Edit bag
            </button>
          </div>
          <div className="summary-items">
            {items.map((i) => {
              const p = products.find((p) => p.id === i.productId)!;
              const price = effectivePrice(p);
              return (
                <div key={p.id} className="summary-item">
                  <div className="summary-thumb">
                    <Image src={p.imageUrl} alt={p.title} fill sizes="64px" />
                    <span>{i.quantity}</span>
                  </div>
                  <div>
                    <h3>{p.title}</h3>
                    <small>{p.category}</small>
                    {p.originalPriceNaira && p.originalPriceNaira > price && (
                      <s>{money(p.originalPriceNaira * i.quantity)}</s>
                    )}
                  </div>
                  <b>{money(price * i.quantity)}</b>
                </div>
              );
            })}
          </div>
          <div className="summary-totals">
            <div>
              <span>Subtotal</span>
              <b>{money(subtotal)}</b>
            </div>
            <div>
              <span>Delivery to {shipping.state}</span>
              <b>
                {fee ? (
                  money(fee)
                ) : (
                  <span className="text-primary">
                    Free <Check size={13} className="inline" />
                  </span>
                )}
              </b>
            </div>
            <div className="summary-total">
              <span>Total</span>
              <b>{money(total)}</b>
            </div>
          </div>
          <div className="summary-delivery">
            <Truck size={17} />
            <span>
              {fee
                ? "Nationwide delivery to your doorstep."
                : "You've unlocked free nationwide delivery."}
            </span>
          </div>
          {serverError && (
            <p className="checkout-error" role="alert">
              {serverError}
            </p>
          )}
          <Button
            type="submit"
            className="w-full min-h-14"
            disabled={busy || (!config.demo && !config.paymentsEnabled)}
          >
            {busy ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {config.demo
                  ? "Preparing your preview..."
                  : "Opening secure payment..."}
              </>
            ) : (
              <>
                {config.demo ? "Place demo order" : `Pay ${money(total)}`}
                <ArrowRight size={17} />
              </>
            )}
          </Button>
          <p className="checkout-terms">
            By continuing, you agree to our <Link href="/terms">terms</Link> and{" "}
            <Link href="/privacy">privacy policy</Link>.
          </p>
          <div className="summary-security">
            <LockKeyhole size={13} />
            {config.demo
              ? "Preview checkout · no real charges"
              : "Payments secured by Paystack"}
          </div>
        </aside>
      </form>
    </div>
  );
}
function ArrowUpRightSmall() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M7 17 17 7M7 7h10v10" />
    </svg>
  );
}
