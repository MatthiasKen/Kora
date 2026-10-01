import "server-only";
import { headers } from "next/headers";
import { currentUser } from "./auth";
import { emailTestAllowed, usesSitesIdentity } from "./email-test-policy";

export async function emailTestOwner() {
  if (!process.env.EMAIL_TEST_OWNER_EMAIL) return null;
  const incoming = await headers();
  // The hosted owner tool is independent of customer Google/Neon setup.
  const account = usesSitesIdentity(process.env.APP_URL) ? null : await currentUser();
  const platformEmail = incoming.get("oai-authenticated-user-email");
  const allowed = emailTestAllowed({
    appUrl: process.env.APP_URL, ownerEmail: process.env.EMAIL_TEST_OWNER_EMAIL,
    platformId: incoming.get("oai-authenticated-user-id"), platformEmail, accountEmail: account?.email,
  });
  if (!allowed) return null;
  return { email: process.env.EMAIL_TEST_OWNER_EMAIL.trim().toLowerCase(), name: account?.name || "Kora customer" };
}
