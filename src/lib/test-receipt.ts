import type { Receipt } from "./types";

export function sampleReceipt(email = "you@example.com", name = "Kora customer", key = "PREVIEW"): Receipt {
  return {
    id: `TEST-${key}`, reference: `EMAIL_TEST_${key}`, status: "demo", demo: true,
    createdAt: new Date().toISOString(), paidAt: null,
    items: [
      { productId: "studio-headphones", title: "Studio Wireless Headphones", imageUrl: "/images/headphones.webp", quantity: 1, priceNaira: 43500, originalPriceNaira: 58000 },
      { productId: "ceramic-mug", title: "Sunday Ceramic Mug", imageUrl: "/images/mug.webp", quantity: 1, priceNaira: 8500, originalPriceNaira: 12000 },
    ],
    subtotalNaira: 52000, shippingNaira: 2500, totalNaira: 54500,
    shipping: { fullName: name, email, phone: "08012345678", address: "12 Sample Street (test address)", city: "Ikeja", state: "Lagos", notes: "Email delivery test only. No shipment." },
  };
}
