import { z } from "zod";

export const phoneSchema = z.string().regex(/^(?:\+?88)?01[3-9]\d{8}$/);

export const orderInputSchema = z.object({
  idempotencyKey: z.string().uuid(),
  customerName: z.string().trim().min(2).max(120),
  email: z.string().email().optional().or(z.literal("")),
  phone: phoneSchema,
  district: z.string().trim().min(2).max(80),
  area: z.string().trim().max(120).optional(),
  address: z.string().trim().min(8).max(500),
  deliveryLocation: z.enum(["inside_dhaka", "outside_dhaka"]),
  paymentMethod: z.enum(["cod", "bkash", "nagad"]),
  transactionId: z.string().trim().min(5).max(80).optional(),
  couponCode: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().optional(),
        quantity: z.number().int().positive().max(20),
      }),
    )
    .min(1)
    .max(50),
});

export const couponValidationSchema = z.object({
  code: z.string().trim().min(1).max(80),
  phone: phoneSchema.optional(),
  items: z
    .array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid().optional(), quantity: z.number().int().positive().max(20) }))
    .min(1),
});

export const reviewInputSchema = z.object({
  productId: z.string().uuid(),
  customerName: z.string().trim().min(2).max(120),
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().trim().min(10).max(2000),
  orderNumber: z.string().trim().max(80).optional(),
  phone: phoneSchema.optional(),
});