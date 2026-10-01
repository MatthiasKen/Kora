import "server-only";
import { headers } from "next/headers";
import { currentUser } from "./auth";
import { usesSitesIdentity, emailTestAllowed } from "./email-test-policy";
import { AppError } from "./errors";
export async function storeOwner() {
  const ownerEmail = process.env.STORE_OWNER_EMAIL || process.env.EMAIL_TEST_OWNER_EMAIL;
  if (!ownerEmail) return null;
  const incoming = await headers();
  const account = usesSitesIdentity(process.env.APP_URL) ? null : await currentUser();
  const allowed = emailTestAllowed({ appUrl: process.env.APP_URL, ownerEmail,
    platformId: incoming.get("oai-authenticated-user-id"), platformEmail: incoming.get("oai-authenticated-user-email"), accountEmail: account?.email });
  return allowed ? { email: ownerEmail.trim().toLowerCase() } : null;
}
export async function requireStoreOwner() {
  const owner = await storeOwner();
  if (!owner) throw new AppError("Only the store owner can manage deliveries.", 403);
  return owner;
}
