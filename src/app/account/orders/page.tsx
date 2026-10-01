import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isDemo } from "@/lib/config";
import { currentUser } from "@/lib/auth";
import { AccountPage } from "@/components/account-page";
export const metadata = {
  title: "Your orders",
  robots: { index: false, follow: false },
};
export default async function OrdersPage() {
  if (!isDemo() && !(await currentUser()))
    redirect("/account?next=/account/orders");
  return (
    <Suspense>
      <AccountPage defaultTab="orders" />
    </Suspense>
  );
}
