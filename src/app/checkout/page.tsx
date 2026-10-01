import { CheckoutPage } from "@/components/checkout-page";
export const metadata = {
  title: "Secure checkout",
  robots: { index: false, follow: false },
};
export default function Checkout() {
  return <CheckoutPage />;
}
