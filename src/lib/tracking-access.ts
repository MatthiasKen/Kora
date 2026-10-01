import { createHmac } from "node:crypto";
import { appOrigin } from "./config";
import { safeEqual } from "./security";
import type { Receipt } from "./types";
const validity = 90 * 24 * 60 * 60;
function signature(reference: string, orderId: string, expiry: number, secret: string) {
  return createHmac("sha256", secret).update("kora-tracking-v1:" + reference + ":" + orderId + ":" + expiry).digest("hex");
}
export function trackingAccessToken(reference: string, orderId: string, paidAt: Date, secret: string) {
  if (secret.length < 32) throw new Error("A strong session secret is required for tracking email links.");
  const expiry = Math.floor(paidAt.getTime() / 1000) + validity;
  return expiry + "." + signature(reference, orderId, expiry, secret);
}
export function validTrackingAccess(token: string | null, reference: string, orderId: string, secret: string, now = Date.now()) {
  if (!token || secret.length < 32 || !/^\d{10}\.[a-f0-9]{64}$/.test(token)) return false;
  const [expiry, supplied] = token.split(".");
  const seconds = Number(expiry);
  return seconds > Math.floor(now / 1000) && seconds <= Math.floor(now / 1000) + validity &&
    safeEqual(supplied, signature(reference, orderId, seconds, secret));
}
export function emailedTrackingUrl(receipt: Receipt) {
  if (receipt.demo || !receipt.paidAt) return null;
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) return null;
  const url = new URL("/track-order", appOrigin());
  url.searchParams.set("reference", receipt.reference);
  url.searchParams.set("access", trackingAccessToken(receipt.reference, receipt.id, new Date(receipt.paidAt), secret));
  return url.toString();
}
