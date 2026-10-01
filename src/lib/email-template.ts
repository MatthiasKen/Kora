import type { Receipt } from "./types";
import { money } from "./utils";
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function orderEmail(receipt: Receipt, trackingUrl: string | null = null) {
  const ship = receipt.shipping;
  const test = receipt.demo === true;
  const totalLabel = test ? "Sample total" : "Total paid";
  const date = new Date(receipt.paidAt || receipt.createdAt).toLocaleString(
    "en-NG",
    { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" },
  );
  const rows = receipt.items
    .map(
      (i) =>
        `<tr><td style="padding:16px 0;border-bottom:1px solid #e8e8df">${escapeHtml(i.title)} × ${i.quantity}</td><td style="text-align:right;border-bottom:1px solid #e8e8df">${i.originalPriceNaira ? `<s style="font-size:12px;color:#888">${money(i.originalPriceNaira)}</s><br>` : ""}${money(i.priceNaira)} each<br><strong>${money(i.priceNaira * i.quantity)}</strong></td></tr>`,
    )
    .join("");
  const intro =
    test
      ? "This is a test email containing a sample receipt. No payment was taken and no order will be shipped."
      : receipt.status === "fulfillment_review"
      ? "Your payment was received after the reservation ended. We are reviewing availability and will contact you to arrange delivery or a refund."
      : "Your payment is confirmed. We're getting your everyday favourites ready.";
  const html = `<!doctype html><html><body style="margin:0;background:#f6f5f0;font-family:Arial,sans-serif;color:#272b22"><div style="max-width:600px;margin:24px auto;background:white;padding:32px 24px;border-radius:16px"><h1 style="font-size:36px;letter-spacing:-2px">kora<span style="color:#56763d">.</span></h1>${test ? '<p style="font-size:12px;font-weight:bold;color:#56763d;letter-spacing:2px">TEST EMAIL · SAMPLE RECEIPT</p>' : ""}<h2>Thank you, ${escapeHtml(ship.fullName)}.</h2><p>${intro}</p><p style="color:#686b61;font-size:13px;overflow-wrap:anywhere">Order: ${escapeHtml(receipt.id)}<br>Payment reference: ${escapeHtml(receipt.reference)}<br>Date: ${escapeHtml(date)} WAT</p><table style="width:100%;border-collapse:collapse;font-size:14px">${rows}<tr><td style="padding-top:20px">Subtotal</td><td style="padding-top:20px;text-align:right">${money(receipt.subtotalNaira)}</td></tr><tr><td style="padding:12px 0">Delivery</td><td style="text-align:right">${receipt.shippingNaira ? money(receipt.shippingNaira) : "Free"}</td></tr><tr style="font-size:20px"><td><strong>${totalLabel}</strong></td><td style="text-align:right"><strong>${money(receipt.totalNaira)}</strong></td></tr></table><h3 style="margin-top:32px">Delivery address</h3><p>${escapeHtml(ship.fullName)}<br>${escapeHtml(ship.address)}<br>${escapeHtml(ship.city)}, ${escapeHtml(ship.state)}, Nigeria<br>${escapeHtml(ship.phone)}</p>${ship.notes ? `<p>Order notes: ${escapeHtml(ship.notes)}</p>` : ""}<hr style="border:0;border-top:1px solid #eee;margin-top:32px"><p style="font-size:12px;color:#686b61">Kora · Everyday, elevated.<br>${test ? "For testing only. This is not a payment receipt." : "Please keep this email as your payment receipt."}</p></div></body></html>`;
  const text = `${test ? "TEST EMAIL · SAMPLE RECEIPT\n" : ""}Thank you, ${ship.fullName}. ${intro}\nOrder: ${receipt.id}\nReference: ${receipt.reference}\nDate: ${date} WAT\n\n${receipt.items.map((i) => `${i.title} x ${i.quantity}: ${money(i.priceNaira)} each${i.originalPriceNaira ? ` (originally ${money(i.originalPriceNaira)})` : ""} = ${money(i.priceNaira * i.quantity)}`).join("\n")}\nSubtotal: ${money(receipt.subtotalNaira)}\nDelivery: ${money(receipt.shippingNaira)}\n${totalLabel}: ${money(receipt.totalNaira)}\n\nDeliver to: ${ship.fullName}, ${ship.address}, ${ship.city}, ${ship.state}, Nigeria. ${ship.phone}`;
  return {
    html: html.replace("</table>", "</table>" + (!test && trackingUrl?.startsWith("https://") ? '<p style="margin:28px 0"><a style="background:#3158ed;color:white;padding:14px 20px;border-radius:8px;text-decoration:none;display:inline-block" href="' + escapeHtml(trackingUrl) + '">Track your delivery</a></p>' : "")),
    text: text + (!test && trackingUrl?.startsWith("https://") ? "\n\nTrack your delivery: " + trackingUrl : ""),
    subject: `Kora · ${test ? "Test order email" : receipt.status === "fulfillment_review" ? "Payment received" : "Order confirmed"} · ${receipt.reference}`,
  };
}
