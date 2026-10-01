import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { appOrigin, isDemo } from "./config";
import { AppError } from "./errors";
export const secretToken = () => randomBytes(32).toString("hex");
export const tokenHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function validPaystackSignature(
  raw: string,
  signature: string | null,
  secret: string,
) {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  return safeEqual(
    createHmac("sha512", secret).update(raw).digest("hex"),
    signature.toLowerCase(),
  );
}
export function assertLive() {
  if (isDemo() || !process.env.DATABASE_URL)
    throw new AppError(
      "This storefront is in demo mode. No real payment will be taken.",
      503,
    );
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== appOrigin())
    throw new AppError(
      "This request did not originate from the storefront.",
      403,
    );
}
export const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: (process.env.APP_URL || process.env.NEXTAUTH_URL || "").startsWith(
    "https://",
  ),
  path: "/",
  maxAge: 30 * 24 * 60 * 60,
});
