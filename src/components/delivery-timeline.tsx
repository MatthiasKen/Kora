"use client";
import { Check, Info, PackageCheck, Truck } from "lucide-react";
import { DELIVERY_LABELS, DELIVERY_STEPS } from "@/lib/delivery";
import type { OrderTracking } from "@/lib/types";
import { cn } from "@/lib/utils";
const date = (value: string) => new Date(value).toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" });
export function DeliveryTimeline({ tracking, compact = false }: { tracking: OrderTracking; compact?: boolean }) {
  const lastStep = tracking.status === "exception" ? Math.max(0, ...tracking.events.map(event => DELIVERY_STEPS.indexOf(event.status))) : DELIVERY_STEPS.indexOf(tracking.status);
  return <section className={cn("delivery-timeline", compact && "compact")}>
    <div className="tracking-status"><span className="tracking-status-icon">{tracking.status === "delivered" ? <PackageCheck size={26} /> : <Truck size={26} />}</span><div><small>{tracking.demo ? "DEMO DELIVERY" : "DELIVERY STATUS"}</small><h2>{DELIVERY_LABELS[tracking.status]}</h2><p>{tracking.destination.city}, {tracking.destination.state}</p></div></div>
    {tracking.demo && <p className="preview-note">This is a sample delivery timeline. No payment was taken and no shipment will be dispatched.</p>}
    {["payment_review", "exception", "awaiting_payment"].includes(tracking.status) && <div className="tracking-alert"><Info size={20} /><p>{tracking.status === "payment_review" ? "Your payment was received. The store is checking availability before preparing delivery." : tracking.status === "awaiting_payment" ? "Delivery begins after your payment has been confirmed." : "The store is reviewing a delivery issue. Check the latest update below."}</p></div>}
    <ol className="delivery-progress" aria-label="Delivery stages">{DELIVERY_STEPS.map((step, index) => <li key={step} className={cn(index <= lastStep && "complete", index === lastStep && "current")} aria-current={index === lastStep ? "step" : undefined}><span>{index < lastStep || tracking.status === "delivered" ? <Check size={15} /> : index + 1}</span><b>{DELIVERY_LABELS[step]}</b></li>)}</ol>
    {(tracking.carrier || tracking.estimatedDeliveryAt) && <dl className="tracking-facts">
      {tracking.carrier && <div><dt>Courier</dt><dd>{tracking.carrier}</dd></div>}
      {tracking.trackingNumber && <div><dt>Tracking number</dt><dd>{tracking.trackingNumber}</dd></div>}
      {tracking.estimatedDeliveryAt && <div><dt>Estimated delivery</dt><dd>{new Date(tracking.estimatedDeliveryAt).toLocaleDateString("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" })}</dd></div>}
      {tracking.trackingUrl && <div><dt>Courier updates</dt><dd><a href={tracking.trackingUrl} target="_blank" rel="noopener noreferrer">Open courier tracking</a></dd></div>}
    </dl>}
    <h3 className="tracking-history-title">Delivery updates</h3>
    <ol className="tracking-history">{[...tracking.events].reverse().map(event => <li key={event.id}><span /><div><b>{event.message}</b>{event.location && <p>{event.location}</p>}<time dateTime={event.createdAt}>{date(event.createdAt)} WAT</time></div></li>)}</ol>
    {!tracking.events.length && <p className="text-subtle">There are no delivery updates yet.</p>}
  </section>;
}
