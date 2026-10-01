"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, RefreshCw, Truck } from "lucide-react";
import { useStore } from "./store-provider";
import { Button } from "./ui/button";
import { DeliveryTimeline } from "./delivery-timeline";
import { demoTracking } from "@/lib/delivery";
import type { OrderTracking } from "@/lib/types";
export function TrackingPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { config, user, orders, hydrated } = useStore();
  const reference = params.get("reference") || "";
  const access = params.get("access") || "";
  const [input, setInput] = useState(reference);
  const [data, setData] = useState<{ scope: string; tracking: OrderTracking } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const scope = reference + ":" + (user?.id || "guest") + ":" + access;
  useEffect(() => { setInput(reference); }, [reference]);
  useEffect(() => {
    if (!hydrated || !reference) { setBusy(false); return; }
    let cancelled = false;
    const controller = new AbortController();
    async function refresh() {
      if (cancelled) return;
      setBusy(true); setError("");
      try {
        let tracking: OrderTracking;
        if (config.demo) {
          const receipt = orders.find(order => order.reference === reference && (order.customerId || "guest") === (user?.id || "guest"));
          if (!receipt) throw new Error("This sample order belongs to another preview account or isn't saved in this browser.");
          tracking = demoTracking(receipt);
        } else {
          const response = await fetch("/api/orders/" + encodeURIComponent(reference) + "/tracking" + (access ? "?access=" + encodeURIComponent(access) : ""), { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Tracking could not load. Please try again.");
          tracking = result;
        }
        if (!cancelled) setData(current => current?.scope === scope && current.tracking.version > tracking.version ? current : { scope, tracking });
      } catch (e) { if (!cancelled) setError((e as Error).message || "Tracking could not load. Please try again."); }
      finally { if (!cancelled) setBusy(false); }
    }
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 30000);
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { cancelled = true; controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [scope, reference, access, config.demo, hydrated, orders, retry]);
  const tracking = data?.scope === scope ? data.tracking : null;
  return <div className="page-width tracking-page">
    <div className="breadcrumb"><Link href="/">Home</Link><span>/</span><span>Track delivery</span></div>
    <div className="tracking-heading"><span className="tracking-status-icon"><Truck size={30} /></span><div><p className="eyebrow">EVERY STEP, IN ONE PLACE</p><h1>Track your delivery.</h1><p>Use your payment reference or open the tracking link in your order email.</p></div></div>
    <form className="tracking-search" noValidate onSubmit={event => { event.preventDefault(); const next = input.trim(); if (!/^(KORA_[a-f0-9]{24}|DEMO_[a-zA-Z0-9_-]+)$/.test(next)) { setError("Enter the complete payment reference from your receipt."); return; } if (next === reference) setRetry(value => value + 1); else router.replace("/track-order?reference=" + encodeURIComponent(next)); }}>
      <label htmlFor="tracking-reference">Payment reference</label><div><input id="tracking-reference" value={input} onChange={e => setInput(e.target.value)} placeholder="KORA_…" autoComplete="off" maxLength={100} /><Button type="submit" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />}{busy ? "Checking…" : "Track order"}</Button></div>
    </form>
    {error && <div className="checkout-error" role="alert">{error}<p><Link href="/account">Sign in to your account</Link> to view your orders.</p></div>}
    {tracking && <><div className="tracking-reference-row"><span>Reference <b>{tracking.reference}</b></span><Button variant="outline" size="sm" disabled={busy} onClick={() => setRetry(value => value + 1)}><RefreshCw size={15} className={busy ? "animate-spin" : ""} />Refresh updates</Button></div><DeliveryTimeline tracking={tracking} /><p className="tracking-refresh-note">Updates appear here when the store or courier records a delivery milestone. This page checks every 30 seconds.</p></>}
    {!reference && <div className="tracking-empty"><Truck size={38} strokeWidth={1.3} /><h2>Your order's journey starts here.</h2><p>Tracking becomes available once your payment is confirmed.</p><Button asChild variant="outline"><Link href="/account/orders">View your orders</Link></Button></div>}
  </div>;
}
