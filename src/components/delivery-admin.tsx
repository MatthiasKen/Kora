"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Package, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "./store-provider";
import { Button } from "./ui/button";
import { DeliveryTimeline } from "./delivery-timeline";
import { useFieldValidation } from "./use-field-validation";
import { deliveryUpdateSchema } from "@/lib/validation";
import { allowedDeliveryTransition, DELIVERY_LABELS, DELIVERY_STEPS, demoTracking } from "@/lib/delivery";
import type { DeliveryStatus, OrderTracking, Receipt } from "@/lib/types";
import { cn, money } from "@/lib/utils";
function DeliveryForm({ receipt, onSaved }: { receipt: Receipt; onSaved: (tracking: OrderTracking) => void }) {
  const { config } = useStore();
  const tracking = receipt.demo ? demoTracking(receipt) : receipt.tracking!;
  const previous = tracking.status === "exception" ? DELIVERY_STEPS[Math.max(0, ...tracking.events.map(event => DELIVERY_STEPS.indexOf(event.status)))] : tracking.status;
  const next = DELIVERY_STEPS[Math.min(DELIVERY_STEPS.length - 1, Math.max(0, DELIVERY_STEPS.indexOf(previous)) + 1)];
  const [value, setValue] = useState({
    status: next as Exclude<DeliveryStatus, "awaiting_payment" | "payment_review">, version: tracking.version,
    idempotencyKey: "00000000-0000-4000-8000-000000000000",
    message: "", location: "", carrier: tracking.carrier || "", trackingNumber: tracking.trackingNumber || "",
    trackingUrl: tracking.trackingUrl || "", estimatedDeliveryAt: tracking.estimatedDeliveryAt?.slice(0,10) || "",
  });
  const fields = useFieldValidation(deliveryUpdateSchema, value);
  const request = useRef<{ payload: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const parsed = fields.validate();
    if (!parsed.success) { document.getElementById("delivery-" + String(parsed.error.issues[0].path[0]))?.focus(); return; }
    setBusy(true); setError("");
    try {
      const payload = JSON.stringify(parsed.data);
      if (request.current?.payload !== payload) request.current = { payload, id: crypto.randomUUID() };
      const input = { ...parsed.data, idempotencyKey: request.current!.id };
      let result: OrderTracking;
      if (config.demo) {
        const rows: Receipt[] = JSON.parse(localStorage.getItem("kora-demo-orders-v1") || "[]");
        const index = rows.findIndex(row => row.id === receipt.id);
        if (index < 0) throw new Error("This sample order is no longer available.");
        const current = demoTracking(rows[index]);
        if (current.version !== input.version) throw new Error("Another update was saved. Refresh this order before making changes.");
        if (!allowedDeliveryTransition(current.status, input.status, previous)) throw new Error("Move to the next delivery step. Completed steps cannot be reversed.");
        const now = new Date().toISOString();
        result = { ...current, status: input.status, version: current.version + 1, updatedAt: now,
          carrier: input.carrier || null, trackingNumber: input.trackingNumber || null, trackingUrl: input.trackingUrl || null,
          estimatedDeliveryAt: input.estimatedDeliveryAt ? input.estimatedDeliveryAt + "T12:00:00Z" : null,
          deliveredAt: input.status === "delivered" ? current.deliveredAt || now : null,
          events: [...current.events, { id: input.idempotencyKey, status: input.status, message: input.message, location: input.location || null, createdAt: now }] };
        rows[index] = { ...rows[index], tracking: result };
        localStorage.setItem("kora-demo-orders-v1", JSON.stringify(rows));
        window.dispatchEvent(new Event("kora-orders-updated"));
      } else {
        const response = await fetch("/api/admin/orders/" + receipt.id + "/delivery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(15000) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "The delivery update could not be saved.");
        result = data;
      }
      onSaved(result); toast.success("Delivery update saved. The customer can now see it.");
    } catch (e) { setError((e as Error).message || "The delivery update could not be saved."); }
    finally { setBusy(false); }
  }
  return <form className="delivery-update-form" noValidate onSubmit={save} aria-busy={busy}>
    <h3>Record a delivery update</h3>
    <label htmlFor="delivery-status">Delivery status</label><select id="delivery-status" value={value.status} onChange={e => setValue(current => ({ ...current, status: e.target.value as typeof current.status }))}>{[...DELIVERY_STEPS, "exception" as const].filter(status => allowedDeliveryTransition(tracking.status, status, previous)).map(status => <option key={status} value={status}>{DELIVERY_LABELS[status]}</option>)}</select>
    <label htmlFor="delivery-message">Customer update</label><textarea id="delivery-message" rows={3} value={value.message} onChange={e => setValue(current => ({ ...current, message: e.target.value }))} onBlur={() => fields.touch("message")} maxLength={500} aria-invalid={!!fields.errors.message} aria-describedby={fields.errors.message ? "delivery-message-error" : undefined} placeholder="Your order has been packed and is ready for dispatch." />{fields.errors.message && <p id="delivery-message-error" className="field-error">{fields.errors.message}</p>}
    <div className="delivery-field-grid">{(["location", "carrier", "trackingNumber", "trackingUrl", "estimatedDeliveryAt"] as const).map(field => <div key={field}><label htmlFor={"delivery-" + field}>{{ location: "Current location (optional)", carrier: "Courier", trackingNumber: "Tracking number (optional)", trackingUrl: "Courier tracking link (optional)", estimatedDeliveryAt: "Estimated delivery (optional)" }[field]}</label><input id={"delivery-" + field} type={field === "estimatedDeliveryAt" ? "date" : field === "trackingUrl" ? "url" : "text"} value={value[field]} onChange={e => setValue(current => ({ ...current, [field]: e.target.value }))} onBlur={() => fields.touch(field)} aria-invalid={!!fields.errors[field]} aria-describedby={fields.errors[field] ? "delivery-" + field + "-error" : undefined} />{fields.errors[field] && <p className="field-error" id={"delivery-" + field + "-error"}>{fields.errors[field]}</p>}</div>)}</div>
    <small>Only record milestones that have happened. Courier tracking links must use HTTPS.</small>
    {error && <div className="checkout-error" role="alert">{error}</div>}
    <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" size={16} />}{busy ? "Saving update…" : "Save delivery update"}</Button>
  </form>;
}
export function DeliveryAdmin() {
  const { config, orders: demoOrders } = useStore();
  const [rows, setRows] = useState<Receipt[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const orders = config.demo ? demoOrders : rows;
  const receipt = orders.find(order => order.id === selected);
  useEffect(() => {
    if (config.demo) return;
    let cancelled = false;
    const controller = new AbortController();
    setBusy(true); setError("");
    void fetch("/api/admin/orders", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Orders could not load."); if (!cancelled) setRows(data); })
      .catch(e => { if (!cancelled) setError(e.message || "Orders could not load."); }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [config.demo, retry]);
  return <div className="page-width delivery-admin">
    <div className="admin-heading"><div><p className="eyebrow">STORE OWNER</p><h1>Orders & delivery.</h1><p>Manage the 50 most recent paid orders and share delivery updates with customers.</p></div><Button variant="outline" disabled={busy} onClick={() => setRetry(value => value + 1)}><RefreshCw size={16} className={busy ? "animate-spin" : ""} />Refresh orders</Button></div>
    {config.demo && <p className="preview-note">Preview tools only. These orders and delivery updates stay in this browser; no payments or shipments take place.</p>}
    {error && <div className="checkout-error" role="alert">{error}</div>}
    <div className="delivery-admin-grid"><aside className="admin-order-list" aria-label="Paid orders">
      {!orders.length && <div className="reviews-empty"><Package size={30} /><h3>{busy ? "Loading orders…" : "No paid orders yet."}</h3><p>Complete a {config.demo ? "demo" : "paid"} checkout to see an order here.</p></div>}
      {orders.map(order => <button key={order.id} className={cn("admin-order-button", selected === order.id && "selected")} onClick={() => setSelected(order.id)}><b>{order.shipping.fullName}</b><span>{order.id.slice(0,8).toUpperCase()} · {money(order.totalNaira)}</span><small>{DELIVERY_LABELS[(order.demo ? demoTracking(order) : order.tracking)?.status || "awaiting_payment"]}</small></button>)}
    </aside><div className="admin-order-detail">
      {receipt ? <><div className="admin-receipt-summary"><h2>Order {receipt.id.slice(0,8).toUpperCase()}</h2><p>{receipt.items.map(item => item.title + " × " + item.quantity).join(", ")}</p><p><b>{receipt.shipping.fullName}</b><br />{receipt.shipping.address}, {receipt.shipping.city}, {receipt.shipping.state}<br />{receipt.shipping.phone}</p></div><DeliveryTimeline tracking={receipt.demo ? demoTracking(receipt) : receipt.tracking!} compact />
        {(receipt.demo || receipt.status === "paid") ? <DeliveryForm key={receipt.id + ":" + (receipt.tracking?.version || 0)} receipt={receipt} onSaved={tracking => setRows(current => current.map(order => order.id === receipt.id ? { ...order, tracking } : order))} /> : <div className="checkout-error">Resolve this payment and stock review before arranging delivery.</div>}
      </> : <div className="admin-select-order"><Package size={36} strokeWidth={1.2} /><h2>Select an order.</h2><p>View the address and record its next delivery milestone.</p></div>}
    </div></div>
  </div>;
}
