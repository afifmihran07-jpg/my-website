import { and, eq } from "drizzle-orm";
import { ZodError, z } from "zod";
import {
  adminSetupStatus,
  bootstrapLogin,
  changeCredentials,
  completeSetup,
  login,
  logout,
  recoveryCodeReset,
  requestPasswordReset,
  requireAdmin,
  resetPassword,
  rotateRecoveryCode,
} from "../server/auth.js";
import {
  allAdminData,
  dashboardMetrics,
  removeCategory,
  removeCoupon,
  removeProduct,
  saveCms,
  saveSetting,
  setReviewModeration,
  updateInventory,
  updateOrderStatus,
  upsertCategory,
  upsertCoupon,
  upsertProduct,
} from "../server/admin.js";
import { createOrder, publicProducts, publicReviews, reactToReview, validateCouponForItems, verifyManualPayment } from "../server/commerce.js";
import { db } from "../server/db/index.js";
import { abandonedCarts, businessSettings, categories, cmsDocuments, newsletterSubscribers, orderItems, orders, reviews } from "../server/db/schema.js";
import { randomToken, sha256 } from "../server/crypto.js";
import { env } from "../server/env.js";
import { ApiRequest, ApiResponse, json, parseCookies, setCookie } from "../server/http.js";
import { deleteProductImage, uploadProductImage } from "../server/images.js";
import { sendPasswordResetEmail } from "../server/notifications.js";
import { couponValidationSchema, reviewInputSchema } from "../server/validation.js";
import { currentCustomer, loginCustomer, logoutCustomer, registerCustomer, saveAddress, toggleWishlist } from "../server/customers.js";

function action(req: ApiRequest): string {
  const raw = req.query?.action;
  return Array.isArray(raw) ? raw[0] : raw ?? "store";
}

function originAllowed(req: ApiRequest) {
  const origin = req.headers.origin;
  if (!origin) return true;
  return (Array.isArray(origin) ? origin[0] : origin) === new URL(env().APP_URL).origin;
}

async function storefront() {
  const [productList, categoryList, cms, settings, reviewList] = await Promise.all([
    publicProducts(),
    db.select().from(categories).where(eq(categories.isActive, true)).orderBy(categories.sortOrder),
    db.select().from(cmsDocuments).orderBy(cmsDocuments.key),
    db.select().from(businessSettings).where(eq(businessSettings.isSecret, false)),
    publicReviews(),
  ]);
  return {
    products: productList,
    categories: categoryList,
    cms: Object.fromEntries(cms.map((entry) => [entry.key, entry.publishedContent])),
    settings: Object.fromEntries(settings.map((entry) => [entry.key, entry.value])),
    reviews: reviewList,
    social: { facebook: env().FACEBOOK_URL, instagram: env().INSTAGRAM_URL },
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const name = action(req);
  const method = req.method?.toUpperCase() ?? "GET";

  try {
    if (!["GET", "HEAD", "OPTIONS"].includes(method) && !originAllowed(req)) return json(res, 403, { error: "Request origin rejected" });
    if (method === "OPTIONS") return res.status(204).end();

    if (method === "GET" && name === "store") return json(res, 200, await storefront());
    if (method === "GET" && name === "products") return json(res, 200, await publicProducts());
    if (method === "GET" && name === "reviews") return json(res, 200, await publicReviews(`${req.query?.productId ?? ""}` || undefined));
    if (method === "POST" && name === "review-create") {
      const input = reviewInputSchema.parse(req.body);
      let verifiedPurchase = false;
      if (input.orderNumber && input.phone) {
        const [order] = await db
          .select({ id: orders.id })
          .from(orders)
          .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
          .where(and(eq(orders.orderNumber, input.orderNumber), eq(orders.phone, input.phone), eq(orderItems.productId, input.productId)))
          .limit(1);
        verifiedPurchase = Boolean(order);
      }
      const [review] = await db.insert(reviews).values({
        productId: input.productId,
        customerName: input.customerName,
        rating: input.rating,
        reviewText: input.reviewText,
        verifiedPurchase,
      }).returning();
      return json(res, 201, review);
    }
    if (method === "POST" && name === "review-react") {
      const input = z.object({ reviewId: z.string().uuid() }).parse(req.body);
      const cookies = parseCookies(req);
      const session = cookies.hss_reaction_session ?? randomToken();
      if (!cookies.hss_reaction_session) setCookie(res, "hss_reaction_session", session, { maxAge: 365 * 24 * 60 * 60, httpOnly: true });
      return json(res, 200, await reactToReview(input.reviewId, sha256(session)));
    }
    if (method === "POST" && name === "coupon-validate") {
      const input = couponValidationSchema.parse(req.body);
      const result = await validateCouponForItems(input);
      return json(res, 200, { code: result.coupon.code, type: result.coupon.type, value: result.coupon.value, discount: result.discount, subtotal: result.subtotal });
    }
    if (method === "POST" && name === "order-create") return json(res, 201, await createOrder(req.body));
    if (method === "GET" && name === "order-track") {
      const orderNumber = `${req.query?.orderNumber ?? ""}`;
      const phone = `${req.query?.phone ?? ""}`;
      const [order] = await db.select().from(orders).where(and(eq(orders.orderNumber, orderNumber), eq(orders.phone, phone))).limit(1);
      if (!order) return json(res, 404, { error: "Order not found" });
      return json(res, 200, { ...order, items: await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)) });
    }
    if (method === "POST" && name === "newsletter") {
      const input = z.object({ email: z.string().email() }).parse(req.body);
      await db.insert(newsletterSubscribers).values({ email: input.email.toLowerCase() }).onConflictDoNothing();
      return json(res, 201, { ok: true });
    }
    if (method === "POST" && name === "abandoned-cart") {
      const input = z.object({ sessionId: z.string().min(8).max(120), items: z.array(z.record(z.string(), z.unknown())).max(50), subtotal: z.number().int().min(0), customerEmail: z.string().email().optional(), customerPhone: z.string().optional() }).parse(req.body);
      await db.insert(abandonedCarts).values(input).onConflictDoUpdate({
        target: abandonedCarts.sessionId,
        set: { items: input.items, subtotal: input.subtotal, customerEmail: input.customerEmail, customerPhone: input.customerPhone, updatedAt: new Date() },
      });
      return json(res, 200, { ok: true });
    }
    if (method === "GET" && name === "customer-session") {
      return json(res, 200, { customer: await currentCustomer(req) });
    }
    if (method === "POST" && name === "customer-register") {
      const input = z.object({ fullName: z.string().min(2).max(120), email: z.string().email(), phone: z.string().regex(/^(?:\+?88)?01[3-9]\d{8}$/), password: z.string().min(8) }).parse(req.body);
      const customer = await registerCustomer(res, input);
      return json(res, 201, { customer });
    }
    if (method === "POST" && name === "customer-login") {
      const input = z.object({ identity: z.string().min(3), password: z.string().min(1) }).parse(req.body);
      const customer = await loginCustomer(res, input.identity, input.password);
      return json(res, 200, { customer });
    }
    if (method === "POST" && name === "customer-logout") {
      await logoutCustomer(req, res);
      return json(res, 200, { ok: true });
    }
    if (method === "POST" && name === "customer-address") {
      const input = z.object({ label: z.string().min(1), recipientName: z.string().min(2), phone: z.string(), district: z.string(), area: z.string().optional(), address: z.string().min(5), deliveryLocation: z.string(), isDefault: z.boolean().default(false) }).parse(req.body);
      return json(res, 201, await saveAddress(req, input as never));
    }
    if (method === "POST" && name === "customer-wishlist") {
      const input = z.object({ productId: z.string().uuid() }).parse(req.body);
      return json(res, 200, await toggleWishlist(req, input.productId));
    }

    if (method === "GET" && name === "setup-status") return json(res, 200, { state: await adminSetupStatus() });
    if (method === "POST" && name === "bootstrap-login") {
      const input = z.object({ username: z.string(), password: z.string() }).parse(req.body);
      const result = await bootstrapLogin(req, res, input.username, input.password);
      return json(res, result.status, result.ok ? { requiresSetup: true } : { error: "Invalid credentials" });
    }
    if (method === "POST" && name === "setup-complete") {
      const input = z.object({ username: z.string(), password: z.string(), recoveryEmail: z.string().email() }).parse(req.body);
      const result = await completeSetup(req, res, input);
      return json(res, result.ok ? 201 : 400, result);
    }
    if (method === "POST" && name === "login") {
      const input = z.object({ username: z.string(), password: z.string() }).parse(req.body);
      const result = await login(req, res, input.username, input.password);
      return json(res, result.status, result.ok ? { ok: true } : { error: "Invalid credentials" });
    }
    if (method === "POST" && name === "logout") {
      await logout(req, res);
      return json(res, 200, { ok: true });
    }
    if (method === "POST" && name === "forgot-password") {
      const input = z.object({ email: z.string().email() }).parse(req.body);
      const reset = await requestPasswordReset(input.email);
      if (reset) await sendPasswordResetEmail(reset.admin.recoveryEmail, `${env().APP_URL}/?resetToken=${encodeURIComponent(reset.raw)}#admin`);
      return json(res, 200, { message: "If the address is registered, reset instructions have been sent." });
    }
    if (method === "POST" && name === "reset-password") {
      const input = z.object({ token: z.string().min(32), password: z.string().min(12) }).parse(req.body);
      return json(res, (await resetPassword(input.token, input.password)) ? 200 : 400, { ok: true });
    }
    if (method === "POST" && name === "emergency-recovery") {
      const input = z.object({ code: z.string().min(19), password: z.string().min(12) }).parse(req.body);
      return json(res, (await recoveryCodeReset(input.code, input.password)) ? 200 : 400, { ok: true });
    }

    const admin = await requireAdmin(req);
    if (!admin) return json(res, 401, { error: "Unauthorized" });

    if (method === "GET" && name === "admin-session") return json(res, 200, { username: admin.username });
    if (method === "GET" && name === "admin-dashboard") return json(res, 200, await dashboardMetrics());
    if (method === "GET" && name === "admin-resource") return json(res, 200, await allAdminData(`${req.query?.resource ?? ""}`));
    if (method === "POST" && name === "admin-category-save") return json(res, 201, await upsertCategory(req.body as never));
    if (method === "DELETE" && name === "admin-category-delete") {
      await removeCategory(`${req.query?.id ?? ""}`);
      return json(res, 200, { ok: true });
    }
    if (method === "POST" && name === "admin-product-save") return json(res, 201, await upsertProduct(req.body as never));
    if (method === "DELETE" && name === "admin-product-delete") {
      await removeProduct(`${req.query?.id ?? ""}`);
      return json(res, 200, { ok: true });
    }
    if (method === "POST" && name === "admin-coupon-save") return json(res, 201, await upsertCoupon(req.body as never));
    if (method === "DELETE" && name === "admin-coupon-delete") {
      await removeCoupon(`${req.query?.id ?? ""}`);
      return json(res, 200, { ok: true });
    }
    if (method === "PATCH" && name === "admin-inventory") {
      const input = z.object({ variantId: z.string().uuid(), stock: z.number().int().min(0) }).parse(req.body);
      return json(res, 200, await updateInventory(input.variantId, input.stock));
    }
    if (method === "PATCH" && name === "admin-order-status") {
      const input = z.object({ orderId: z.string().uuid(), status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refund_requested", "refunded"]) }).parse(req.body);
      return json(res, 200, await updateOrderStatus(input.orderId, input.status));
    }
    if (method === "POST" && name === "admin-payment-verify") {
      const input = z.object({ orderId: z.string().uuid(), approved: z.boolean(), note: z.string().max(1000).optional() }).parse(req.body);
      return json(res, 200, await verifyManualPayment(admin.adminId, input.orderId, input.approved, input.note));
    }
    if (method === "PATCH" && name === "admin-review") {
      const input = z.object({ id: z.string().uuid(), status: z.enum(["pending", "approved", "rejected"]).optional(), isHidden: z.boolean().optional(), featuredOnHomepage: z.boolean().optional() }).parse(req.body);
      return json(res, 200, await setReviewModeration(input.id, input));
    }
    if (method === "POST" && name === "admin-cms") {
      const input = z.object({ key: z.string().min(1), content: z.record(z.string(), z.unknown()), publish: z.boolean().default(false) }).parse(req.body);
      return json(res, 200, await saveCms(input.key, input.content, input.publish));
    }
    if (method === "POST" && name === "admin-setting") {
      const input = z.object({ key: z.string().min(1), value: z.unknown() }).parse(req.body);
      return json(res, 200, await saveSetting(input.key, input.value));
    }
    if (method === "POST" && name === "admin-image-upload") {
      const input = z.object({ productId: z.string().uuid(), dataUri: z.string().min(100) }).parse(req.body);
      return json(res, 201, await uploadProductImage(input.dataUri, input.productId));
    }
    if (method === "DELETE" && name === "admin-image-delete") {
      await deleteProductImage(`${req.query?.publicId ?? ""}`);
      return json(res, 200, { ok: true });
    }
    if (method === "POST" && name === "admin-security-change") {
      const input = z.object({ currentPassword: z.string(), username: z.string().optional(), password: z.string().optional(), recoveryEmail: z.string().email().optional() }).parse(req.body);
      return json(res, (await changeCredentials(admin.adminId, input)) ? 200 : 400, { ok: true });
    }
    if (method === "POST" && name === "admin-recovery-code") {
      const input = z.object({ currentPassword: z.string() }).parse(req.body);
      const code = await rotateRecoveryCode(admin.adminId, input.currentPassword);
      return json(res, code ? 200 : 400, code ? { code } : { error: "Verification failed" });
    }

    return json(res, 404, { error: "Not found" });
  } catch (error) {
    if (error instanceof ZodError) return json(res, 400, { error: "Invalid request", fields: error.flatten().fieldErrors });
    const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
    const known = ["COUPON_UNAVAILABLE", "COUPON_MINIMUM_NOT_MET", "COUPON_LIMIT_REACHED", "INSUFFICIENT_STOCK", "TRANSACTION_ID_REQUIRED", "CATEGORY_HAS_PRODUCTS"];
    return json(res, known.includes(message) ? 400 : 500, { error: known.includes(message) ? message : "Internal server error" });
  }
}