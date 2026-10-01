import type { DeliveryStatus, OrderTracking, Receipt } from "./types";
export const DELIVERY_STEPS: DeliveryStatus[] = ["processing", "packed", "shipped", "out_for_delivery", "delivered"];
export const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
  awaiting_payment: "Awaiting payment", payment_review: "Payment under review",
  processing: "Preparing your order", packed: "Packed and ready", shipped: "With the courier",
  out_for_delivery: "Out for delivery", delivered: "Delivered", exception: "Delivery update needed",
};
export function allowedDeliveryTransition(current: DeliveryStatus, next: DeliveryStatus, previous: DeliveryStatus = current) {
  if (current === "awaiting_payment" || current === "payment_review") return false;
  if (current === "delivered") return next === "delivered";
  if (next === "exception") return true;
  const from = DELIVERY_STEPS.indexOf(current === "exception" ? previous : current);
  const to = DELIVERY_STEPS.indexOf(next);
  return from >= 0 && (to === from || to === from + 1);
}
export function demoTracking(receipt: Receipt): OrderTracking {
  return receipt.tracking ?? {
    orderId: receipt.id, reference: receipt.reference, paymentStatus: "demo",
    status: "processing", carrier: null, trackingNumber: null, trackingUrl: null,
    estimatedDeliveryAt: null, deliveredAt: null, updatedAt: receipt.createdAt, version: 0,
    destination: { city: receipt.shipping.city, state: receipt.shipping.state },
    events: [{ id: receipt.id + "-demo", status: "processing", message: "Demo checkout completed. No payment was taken and no shipment will be dispatched.", location: null, createdAt: receipt.createdAt }],
    demo: true,
  };
}
