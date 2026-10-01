import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { EmailTestPage } from "@/components/email-test-page";
import { emailTestOwner } from "@/lib/email-test-access";
import { mailgunStatus } from "@/lib/mailgun-client";
import { orderEmail } from "@/lib/email-template";
import { sampleReceipt } from "@/lib/test-receipt";

export const dynamic = "force-dynamic";
export const metadata = { title: "Test email delivery", robots: { index: false, follow: false } };
export default async function EmailTesting() {
  const owner = await emailTestOwner();
  if (!owner) return <div className="page-width status-page"><ShieldCheck className="mx-auto mb-5" size={36} strokeWidth={1.3} /><h1>Owner access required.</h1><p>Sign in with the store owner's account to test email delivery.</p><Link href="/account" className="text-primary underline mt-6 inline-block">Go to your account</Link></div>;
  return <EmailTestPage configuration={mailgunStatus()} owner={owner} preview={orderEmail(sampleReceipt(owner.email, owner.name)).html} />;
}
