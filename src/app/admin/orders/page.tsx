import Link from "next/link";
import { storeOwner } from "@/lib/store-owner";
import { DeliveryAdmin } from "@/components/delivery-admin";
export const metadata = { title: "Manage orders & delivery", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function ManageOrders() {
  const owner = await storeOwner();
  if (!owner) return <div className="page-width status-page"><h1>Store owner access required.</h1><p>Sign in with the store owner's account to manage deliveries.</p><Link href="/account">Go to sign in</Link></div>;
  return <DeliveryAdmin />;
}
