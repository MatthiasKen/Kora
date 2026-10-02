export function isDemo() {
  return (
    process.env.APP_MODE === "demo" ||
    (!process.env.DATABASE_URL && process.env.APP_MODE !== "live")
  );
}
export function storeConfig() {
  const demo = isDemo();
  return {
    demo,
    googleEnabled:
      !demo &&
      !!process.env.GOOGLE_CLIENT_ID &&
      !!process.env.GOOGLE_CLIENT_SECRET &&
      !!process.env.NEXTAUTH_SECRET,
    paymentsEnabled: !demo && !!process.env.PAYSTACK_SECRET_KEY,
  };
}
export function appUrl() {
  const configured = process.env.APP_URL || process.env.NEXTAUTH_URL;
  if (configured) return configured;
  // These domains come from Vercel's environment, never request headers.
  if (process.env.VERCEL !== "1") return undefined;
  const host = process.env.VERCEL_ENV === "production"
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL
    : process.env.VERCEL_ENV === "preview" ? process.env.VERCEL_URL : undefined;
  return host ? `https://${host}` : undefined;
}
export function appOrigin() {
  const url = appUrl();
  if (!url) throw new Error("APP_URL is required for live checkout.");
  return new URL(url).origin;
}
