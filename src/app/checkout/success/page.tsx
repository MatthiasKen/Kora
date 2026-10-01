import { Suspense } from "react";
import { ReceiptPage } from "@/components/receipt-page";
export const metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};
export default function Success() {
  return (
    <Suspense
      fallback={
        <div className="page-width status-page">Loading your order...</div>
      }
    >
      <ReceiptPage />
    </Suspense>
  );
}
