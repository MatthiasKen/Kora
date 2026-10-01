import { AppError } from "./errors";
export type VerifiedPayment = {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  customer: { email: string };
  paid_at?: string;
};
async function paystack(path: string, init: RequestInit = {}) {
  if (!process.env.PAYSTACK_SECRET_KEY)
    throw new AppError(
      "Payments are not configured yet. Please contact the store.",
      503,
    );
  const response = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const json = await response.json();
  if (!response.ok || json.status !== true)
    throw new AppError(
      "The payment provider is temporarily unavailable. Please try again.",
      502,
    );
  return json.data;
}
export async function initializePayment(
  reference: string,
  email: string,
  totalNaira: number,
  callbackUrl: string,
) {
  const data = await paystack("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      reference,
      email,
      amount: totalNaira * 100,
      currency: "NGN",
      callback_url: callbackUrl,
      channels: ["card", "bank_transfer", "ussd"],
      metadata: { store: "Kora", reference },
    }),
  });
  const url = new URL(data.authorization_url);
  if (url.protocol !== "https:" || url.hostname !== "checkout.paystack.com")
    throw new AppError(
      "The payment provider returned an invalid checkout address.",
      502,
    );
  return url.toString();
}
export async function verifyPayment(
  reference: string,
): Promise<VerifiedPayment> {
  return paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
}
export function assertPaymentMatches(
  payment: VerifiedPayment,
  expected: { reference: string; totalNaira: number; email: string },
) {
  if (payment.status !== "success")
    throw new AppError(
      "Your payment is still pending or was unsuccessful. Please check again.",
      409,
    );
  if (
    payment.reference !== expected.reference ||
    payment.currency !== "NGN" ||
    !Number.isSafeInteger(payment.amount) ||
    payment.amount !== expected.totalNaira * 100 ||
    payment.customer?.email?.toLowerCase() !== expected.email.toLowerCase()
  )
    throw new AppError(
      "Payment details could not be matched to this order.",
      400,
    );
}
