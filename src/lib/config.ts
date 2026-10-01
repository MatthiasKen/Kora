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
export function appOrigin() {
  const url = process.env.APP_URL || process.env.NEXTAUTH_URL;
  if (!url) throw new Error("APP_URL is required for live checkout.");
  return new URL(url).origin;
}
