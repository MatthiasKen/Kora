import { Suspense } from "react";
import { AccountPage } from "@/components/account-page";
export const metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};
export default function Account() {
  return (
    <Suspense>
      <AccountPage />
    </Suspense>
  );
}
