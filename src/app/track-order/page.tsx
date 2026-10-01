import { Suspense } from "react";
import { TrackingPage } from "@/components/tracking-page";
export const metadata = { title: "Track your delivery", robots: { index: false, follow: false } };
export default function TrackOrder() {
  return <Suspense fallback={<div className="page-width status-page">Loading delivery tracking…</div>}><TrackingPage /></Suspense>;
}
