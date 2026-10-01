"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Info,
  Loader2,
  MapPin,
  PackageCheck,
  RefreshCw,
} from "lucide-react";
import { useStore } from "./store-provider";
import { Button } from "./ui/button";
import type { Receipt } from "@/lib/types";
import { money } from "@/lib/utils";
import { DeliveryTimeline } from "./delivery-timeline";
import { demoTracking } from "@/lib/delivery";
export function ReceiptDetails({ receipt }: { receipt: Receipt }) {
  return (
    <div className="receipt-details">
      <div className="receipt-meta">
        <div>
          <small>ORDER ID</small>
          <b>{receipt.id.slice(0, 8).toUpperCase()}</b>
        </div>
        <div>
          <small>PAYMENT REFERENCE</small>
          <b>{receipt.reference}</b>
        </div>
        <div>
          <small>DATE</small>
          <b>
            {new Date(receipt.createdAt).toLocaleDateString("en-NG", {
              dateStyle: "medium",
              timeZone: "Africa/Lagos",
            })}
          </b>
        </div>
      </div>
      <div className="receipt-items">
        {receipt.items.map((item) => (
          <div key={item.productId}>
            <div className="receipt-thumb">
              <Image src={item.imageUrl} alt={item.title} fill sizes="56px" />
            </div>
            <div>
              <h3>{item.title}</h3>
              <small>
                Quantity: {item.quantity}
                {item.originalPriceNaira && (
                  <>
                    {" "}
                    · <s>{money(item.originalPriceNaira)}</s>{" "}
                    <span className="text-primary">
                      {money(item.priceNaira)} each
                    </span>
                  </>
                )}
              </small>
            </div>
            <b>{money(item.quantity * item.priceNaira)}</b>
          </div>
        ))}
      </div>
      <div className="receipt-totals">
        <div>
          <span>Subtotal</span>
          <span>{money(receipt.subtotalNaira)}</span>
        </div>
        <div>
          <span>Delivery</span>
          <span>
            {receipt.shippingNaira ? money(receipt.shippingNaira) : "Free"}
          </span>
        </div>
        <div>
          <b>{receipt.demo ? "Demo total" : "Total paid"}</b>
          <b>{money(receipt.totalNaira)}</b>
        </div>
      </div>
      <div className="receipt-address">
        <MapPin size={20} />
        <div>
          <small>DELIVER TO</small>
          <b>{receipt.shipping.fullName}</b>
          <p>
            {receipt.shipping.address}
            <br />
            {receipt.shipping.city}, {receipt.shipping.state}, Nigeria
            <br />
            {receipt.shipping.phone}
          </p>
        </div>
      </div>
      {(receipt.demo || receipt.paidAt) && <div className="receipt-tracking"><Button asChild variant="outline"><Link href={"/track-order?reference=" + encodeURIComponent(receipt.reference)}>Track your delivery</Link></Button>{(receipt.demo || receipt.tracking) && <DeliveryTimeline tracking={receipt.demo ? demoTracking(receipt) : receipt.tracking!} compact />}</div>}
    </div>
  );
}
export function ReceiptPage() {
  const { config, hydrated, refreshCart, user } = useStore();
  const params = useSearchParams();
  const reference = params.get("reference") || params.get("trxref");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const refreshRef = useRef(refreshCart);
  refreshRef.current = refreshCart;
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setReceipt(null);
    if (!reference) {
      setError("No order reference was provided.");
      setLoading(false);
      return;
    }
    if (config.demo) {
      try {
        const rows: Receipt[] = JSON.parse(
          localStorage.getItem("kora-demo-orders-v1") || "[]",
        );
        const order = rows.find((o) => o.reference === reference && (o.customerId || "guest") === (user?.id || "guest"));
        if (order) setReceipt(order);
        else setError("This sample order isn't available in this browser.");
      } catch {
        setError("Couldn't load this sample order.");
      }
      setLoading(false);
      return;
    }
    void fetch(`/api/orders/${encodeURIComponent(reference)}?verify=1`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Couldn't verify your order.");
        if (!cancelled) {
          setReceipt(data);
          sessionStorage.removeItem("kora-checkout-id");
          await refreshRef.current();
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reference, hydrated, config.demo, retry, user?.id]);
  if (loading)
    return (
      <div className="page-width status-page">
        <Loader2 className="mx-auto animate-spin text-primary" size={32} />
        <h1>Checking your good finds.</h1>
        <p>
          We're confirming your payment securely. Please keep this page open.
        </p>
      </div>
    );
  if (error || !receipt)
    return (
      <div className="page-width status-page">
        <Info className="mx-auto text-primary" size={32} />
        <h1>Let's check that once more.</h1>
        <p>{error || "Your order hasn't loaded yet."}</p>
        <Button onClick={() => setRetry((value) => value + 1)}>
          <RefreshCw size={16} />
          Check payment again
        </Button>
        <Link href="/account" className="block mt-5 text-sm text-primary">
          View your account
        </Link>
      </div>
    );
  const review = receipt.status === "fulfillment_review";
  return (
    <div className="page-width receipt-page">
      <div className={`receipt-success-icon ${review ? "review" : ""}`}>
        {review ? <Info size={32} /> : <Check size={34} strokeWidth={1.5} />}
      </div>
      <p className="eyebrow">
        {receipt.demo
          ? "A LITTLE PREVIEW OF WHAT'S NEXT"
          : review
            ? "PAYMENT RECEIVED"
            : "THANK YOU FOR SHOPPING WITH KORA"}
      </p>
      <h1>
        {receipt.demo
          ? "Your demo order is ready."
          : review
            ? "We're reviewing your order."
            : "Good choices. Great day."}
      </h1>
      <p className="receipt-intro">
        {receipt.demo
          ? "You've tried the full shopping experience. No payment was taken and no email was sent."
          : review
            ? "Your payment arrived after your stock reservation ended. We'll contact you to arrange fulfilment or a refund."
            : `Your payment is confirmed. We'll send your receipt to ${receipt.shipping.email}.`}
      </p>
      <ReceiptDetails receipt={receipt} />
      <div className="receipt-actions">
        <Button asChild>
          <Link href="/shop">
            Find a little more good <ArrowRight size={17} />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/account">
            View your orders <PackageCheck size={16} />
          </Link>
        </Button>
      </div>
    </div>
  );
}
