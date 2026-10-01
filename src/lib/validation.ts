import { z } from "zod";
import { NIGERIAN_STATES } from "./utils";
const emailField = z
  .string()
  .trim()
  .max(254, "Use an email address under 255 characters.")
  .pipe(z.email("Please enter a valid email address."))
  .transform((v) => v.toLowerCase());
export const emailRecipientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter a name with at least 2 characters.")
    .max(100, "Use a name under 101 characters."),
  email: emailField,
});
export const previewAccountSchema = emailRecipientSchema;
export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Choose a rating from 1 to 5 stars.").max(5),
  title: z.string().trim().min(3, "Add a title with at least 3 characters.").max(120, "Keep your title under 121 characters."),
  body: z.string().trim().min(10, "Tell us a little more, using at least 10 characters.").max(1500, "Keep your review under 1,501 characters."),
});
export const deliveryUpdateSchema = z.object({
  status: z.enum(["processing", "packed", "shipped", "out_for_delivery", "delivered", "exception"]),
  version: z.number().int().nonnegative(),
  idempotencyKey: z.uuid(),
  message: z.string().trim().min(8, "Add a delivery update with at least 8 characters.").max(500),
  location: z.string().trim().max(120).default(""),
  carrier: z.string().trim().max(80).default(""),
  trackingNumber: z.string().trim().max(120).default(""),
  trackingUrl: z.string().trim().max(500).default("").refine((value) => {
    if (!value) return true;
    try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !/^(localhost|127\.|0\.|\[|.*\.local$)/i.test(url.hostname); } catch { return false; }
  }, "Use a public HTTPS courier tracking link."),
  estimatedDeliveryAt: z.string().default("").refine((value) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T12:00:00Z")) && new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value), "Use a valid delivery date."),
}).superRefine((value, ctx) => {
  if (["shipped", "out_for_delivery", "delivered"].includes(value.status) && value.carrier.length < 2)
    ctx.addIssue({ code: "custom", path: ["carrier"], message: "Enter the courier or delivery team." });
});
export const shippingSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name.").max(100),
  email: emailField,
  phone: z
    .string()
    .trim()
    .regex(
      /^(?:\+234|234|0)[789][01]\d{8}$/,
      "Use a Nigerian phone number, such as 08012345678.",
    ),
  address: z
    .string()
    .trim()
    .min(6, "Please enter a complete delivery address.")
    .max(300),
  city: z.string().trim().min(2, "Please enter your delivery city.").max(100),
  state: z.enum(NIGERIAN_STATES),
  notes: z.string().trim().max(500).optional(),
});
export const checkoutSchema = z.object({
  shipping: shippingSchema,
  idempotencyKey: z.uuid(),
  expectedTotalNaira: z.number().int().positive().max(20000000),
});
