export type Product = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  priceNaira: number;
  originalPriceNaira: number | null;
  stock: number;
  reserved: number;
  imageUrl: string;
  isDailyDeal: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  dealEndsAt: string | null;
  rating: string;
  reviewCount: number;
  features: string[];
  color: string;
};
export type CartLine = { productId: string; quantity: number };
export type ShippingAddress = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  notes?: string;
};
export type ReceiptItem = {
  productId: string;
  title: string;
  imageUrl: string;
  quantity: number;
  priceNaira: number;
  originalPriceNaira: number | null;
};
export type Receipt = {
  id: string;
  reference: string;
  status: string;
  items: ReceiptItem[];
  subtotalNaira: number;
  shippingNaira: number;
  totalNaira: number;
  shipping: ShippingAddress;
  createdAt: string;
  paidAt: string | null;
  demo?: boolean;
  customerId?: string;
  tracking?: OrderTracking;
};

export type Review = {
  id: string; productId: string; authorId?: string; author: string;
  rating: number; title: string; body: string; verifiedPurchase: boolean;
  createdAt: string; updatedAt: string; demo?: boolean;
};
export type ReviewSummary = { count: number; average: number; distribution: Record<number, number> };
export type ReviewPage = { reviews: Review[]; summary: ReviewSummary; hasMore: boolean; page: number; eligible: boolean; ownReview: Review | null };
export type DeliveryStatus = "awaiting_payment" | "payment_review" | "processing" | "packed" | "shipped" | "out_for_delivery" | "delivered" | "exception";
export type OrderTracking = {
  orderId: string; reference: string; paymentStatus: string; status: DeliveryStatus;
  carrier: string | null; trackingNumber: string | null; trackingUrl: string | null;
  estimatedDeliveryAt: string | null; deliveredAt: string | null; updatedAt: string;
  version: number; destination: { city: string; state: string };
  events: { id: string; status: DeliveryStatus; message: string; location: string | null; createdAt: string }[];
  demo?: boolean;
};
export type StoreConfig = {
  demo: boolean;
  googleEnabled: boolean;
  paymentsEnabled: boolean;
  emailTestingAvailable?: boolean;
  ownerToolsAvailable?: boolean;
};
