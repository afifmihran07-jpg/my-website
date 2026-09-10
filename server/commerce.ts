import { and, asc, count, desc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "./db/index.js";
import {
  adminNotifications,
  businessSettings,
  categories,
  couponUsages,
  coupons,
  orderItems,
  orders,
  paymentVerifications,
  productImages,
  products,
  productVariants,
  reviewReactions,
  reviews,
} from "./db/schema.js";
import { sendTransactionalSms } from "./notifications.js";
import { orderInputSchema } from "./validation.js";

async function settingNumber(key: string, fallback: number) {
  const [row] = await db.select().from(businessSettings).where(eq(businessSettings.key, key)).limit(1);
  return typeof row?.value === "number" ? row.value : fallback;
}

export async function publicProducts() {
  const rows = await db
    .select()
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.isPublished, true), eq(categories.isActive, true)))
    .orderBy(desc(products.createdAt));

  const ids = rows.map((row) => row.products.id);
  if (!ids.length) return [];
  const [images, variants] = await Promise.all([
    db.select().from(productImages).where(inArray(productImages.productId, ids)).orderBy(asc(productImages.sortOrder)),
    db.select().from(productVariants).where(and(inArray(productVariants.productId, ids), eq(productVariants.isActive, true))),
  ]);
  return rows.map(({ products: product, categories: category }) => ({
    ...product,
    category: category.slug,
    categoryName: category.name,
    images: images.filter((image) => image.productId === product.id),
    variants: variants.filter((variant) => variant.productId === product.id),
  }));
}

export async function validateCouponForItems(input: {
  code: string;
  phone?: string;
  customerId?: string;
  items: Array<{ productId: string; variantId?: string; quantity: number }>;
}) {
  const now = new Date();
  const [coupon] = await db
    .select()
    .from(coupons)
    .where(
      and(
        eq(coupons.code, input.code.trim().toUpperCase()),
        eq(coupons.isActive, true),
        or(isNull(coupons.startsAt), lte(coupons.startsAt, now)),
        or(isNull(coupons.endsAt), gt(coupons.endsAt, now)),
      ),
    )
    .limit(1);
  if (!coupon) throw new Error("COUPON_UNAVAILABLE");

  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const productRows = await db.select().from(products).where(inArray(products.id, productIds));
  const variantIds = input.items.flatMap((item) => (item.variantId ? [item.variantId] : []));
  const variants = variantIds.length ? await db.select().from(productVariants).where(inArray(productVariants.id, variantIds)) : [];

  let subtotal = 0;
  let eligibleSubtotal = 0;
  for (const item of input.items) {
    const product = productRows.find((row) => row.id === item.productId);
    if (!product) throw new Error("PRODUCT_NOT_FOUND");
    const variant = item.variantId ? variants.find((row) => row.id === item.variantId) : undefined;
    const price = variant?.price ?? product.price;
    const line = price * item.quantity;
    subtotal += line;
    const eligible = (!coupon.productId || coupon.productId === product.id) && (!coupon.categoryId || coupon.categoryId === product.categoryId);
    if (eligible) eligibleSubtotal += line;
  }
  if (coupon.minOrderValue && subtotal < coupon.minOrderValue) throw new Error("COUPON_MINIMUM_NOT_MET");
  if (eligibleSubtotal <= 0) throw new Error("COUPON_NOT_APPLICABLE");

  const [{ value: useCount }] = await db.select({ value: count() }).from(couponUsages).where(eq(couponUsages.couponId, coupon.id));
  if (coupon.usageLimit && useCount >= coupon.usageLimit) throw new Error("COUPON_LIMIT_REACHED");
  if (coupon.perCustomerLimit && input.phone) {
    const [{ value: customerUses }] = await db
      .select({ value: count() })
      .from(couponUsages)
      .where(and(eq(couponUsages.couponId, coupon.id), eq(couponUsages.customerPhone, input.phone)));
    if (customerUses >= coupon.perCustomerLimit) throw new Error("COUPON_CUSTOMER_LIMIT_REACHED");
  }

  let discount = coupon.type === "percentage" ? Math.round((eligibleSubtotal * coupon.value) / 100) : coupon.value;
  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(discount, subtotal);
  return { coupon, subtotal, discount };
}

export async function createOrder(raw: unknown) {
  const input = orderInputSchema.parse(raw);

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(orders).where(eq(orders.idempotencyKey, input.idempotencyKey)).limit(1);
    if (existing) return existing;

    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const productRows = await tx.select().from(products).where(inArray(products.id, productIds)).for("update");
    const variantIds = input.items.flatMap((item) => (item.variantId ? [item.variantId] : []));
    const variants = variantIds.length
      ? await tx.select().from(productVariants).where(inArray(productVariants.id, variantIds)).for("update")
      : [];

    let subtotal = 0;
    const snapshots: Array<typeof orderItems.$inferInsert> = [];
    for (const item of input.items) {
      const product = productRows.find((row) => row.id === item.productId);
      if (!product || !product.isPublished) throw new Error("PRODUCT_UNAVAILABLE");
      const variant = item.variantId ? variants.find((row) => row.id === item.variantId && row.productId === product.id) : undefined;
      const available = variant ? variant.stock - variant.reservedStock : product.stock;
      if (available < item.quantity) throw new Error("INSUFFICIENT_STOCK");
      const unitPrice = variant?.price ?? product.price;
      subtotal += unitPrice * item.quantity;
      snapshots.push({
        orderId: "00000000-0000-0000-0000-000000000000",
        productId: product.id,
        variantId: variant?.id,
        productName: product.name,
        sku: variant?.sku ?? product.sku,
        category: product.categoryId,
        unitPrice,
        quantity: item.quantity,
        selectedSize: variant?.size,
        selectedColor: variant?.colorName,
        posterSize: variant?.posterSizeName,
        posterDimensions: variant?.width && variant?.height ? `${variant.width} × ${variant.height} ${variant.unit ?? "IN"}` : null,
        lineTotal: unitPrice * item.quantity,
      });
    }

    let couponResult: Awaited<ReturnType<typeof validateCouponForItems>> | undefined;
    if (input.couponCode) {
      // Serialize coupon validation/usage for this code to prevent concurrent limit bypass.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.couponCode.toUpperCase()}))`);
      couponResult = await validateCouponForItems({ code: input.couponCode, phone: input.phone, items: input.items });
    }
    const deliveryCharge = input.deliveryLocation === "inside_dhaka"
      ? await settingNumber("delivery.insideDhaka", 80)
      : await settingNumber("delivery.outsideDhaka", 120);
    const discount = couponResult?.discount ?? 0;
    const total = subtotal - discount + deliveryCharge;
    const manual = input.paymentMethod === "bkash" || input.paymentMethod === "nagad";
    if (manual && !input.transactionId) throw new Error("TRANSACTION_ID_REQUIRED");
    const [duplicatePayment] = manual && input.transactionId
      ? await tx.select({ orderNumber: orders.orderNumber }).from(orders).where(eq(orders.transactionId, input.transactionId.toUpperCase())).limit(1)
      : [];

    const sequence = await tx.execute<{ nextval: string }>(sql`select nextval('hss_order_number_seq')::text as nextval`);
    const orderNumber = `HSS-${new Date().getFullYear()}-${String(sequence[0].nextval).padStart(6, "0")}`;
    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber,
        customerName: input.customerName,
        email: input.email || null,
        phone: input.phone,
        district: input.district,
        area: input.area,
        address: input.address,
        deliveryLocation: input.deliveryLocation,
        subtotal,
        discount,
        deliveryCharge,
        total,
        couponId: couponResult?.coupon.id,
        couponCode: couponResult?.coupon.code,
        couponType: couponResult?.coupon.type,
        couponValue: couponResult?.coupon.value,
        paymentMethod: input.paymentMethod,
        paymentStatus: manual ? "pending_verification" : "pending",
        transactionId: input.transactionId?.toUpperCase(),
        orderStatus: "pending",
        notes: input.notes,
        idempotencyKey: input.idempotencyKey,
      })
      .returning();

    await tx.insert(orderItems).values(snapshots.map((item) => ({ ...item, orderId: order.id })));
    for (const item of input.items) {
      if (item.variantId) {
        await tx
          .update(productVariants)
          .set({ stock: sql`${productVariants.stock} - ${item.quantity}`, updatedAt: new Date() })
          .where(and(eq(productVariants.id, item.variantId), sql`${productVariants.stock} >= ${item.quantity}`));
      } else {
        await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${item.quantity}`, updatedAt: new Date() })
          .where(and(eq(products.id, item.productId), sql`${products.stock} >= ${item.quantity}`));
      }
    }
    if (couponResult) {
      await tx.insert(couponUsages).values({
        couponId: couponResult.coupon.id,
        orderId: order.id,
        customerPhone: input.phone,
        discountAmount: discount,
      });
    }
    if (manual) {
      await tx.insert(adminNotifications).values({
        orderId: order.id,
        type: duplicatePayment ? "possible_duplicate_transaction" : "payment_verification_required",
        message: duplicatePayment
          ? `POSSIBLE DUPLICATE TRANSACTION: ${input.transactionId} also appears on ${duplicatePayment.orderNumber}. Review ${orderNumber} manually.`
          : `Verify ${input.paymentMethod.toUpperCase()} transaction ${input.transactionId} for ${orderNumber} (৳${total})`,
      });
    }

    void sendTransactionalSms({
      orderId: order.id,
      phone: order.phone,
      template: "order_received",
      message: manual
        ? `Your HSS order ${orderNumber} has been received and payment is pending verification.`
        : `Your HSS order ${orderNumber} has been received. Payment: Cash on Delivery.`,
    });
    return order;
  });
}

export async function verifyManualPayment(adminId: string, orderId: string, approved: boolean, note?: string) {
  const result = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
    if (!order) throw new Error("ORDER_NOT_FOUND");
    if (order.paymentStatus !== "pending_verification" && order.paymentStatus !== "rejected") throw new Error("PAYMENT_ALREADY_PROCESSED");
    const nextPayment = approved ? "paid" : "rejected";
    const nextOrder = approved ? "confirmed" : "pending";
    await tx
      .update(orders)
      .set({ paymentStatus: nextPayment, orderStatus: nextOrder, updatedAt: new Date() })
      .where(eq(orders.id, order.id));
    await tx.insert(paymentVerifications).values({
      orderId: order.id,
      adminId,
      previousStatus: order.paymentStatus,
      newStatus: nextPayment,
      note,
    });
    return { ...order, paymentStatus: nextPayment, orderStatus: nextOrder };
  });

  await sendTransactionalSms({
    orderId: result.id,
    phone: result.phone,
    template: approved ? "payment_verified" : "payment_rejected",
    message: approved
      ? `Your HSS order ${result.orderNumber} payment has been verified and your order is confirmed.`
      : `Your HSS order ${result.orderNumber} could not be verified. Please contact HSS.`,
  });
  return result;
}

export async function reactToReview(reviewId: string, sessionHash: string, customerId?: string) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(reviewReactions)
      .where(and(eq(reviewReactions.reviewId, reviewId), eq(reviewReactions.sessionHash, sessionHash)))
      .limit(1);
    if (existing) {
      await tx.delete(reviewReactions).where(and(eq(reviewReactions.reviewId, reviewId), eq(reviewReactions.sessionHash, sessionHash)));
    } else {
      await tx.insert(reviewReactions).values({ reviewId, sessionHash, customerId });
    }
    const [{ value }] = await tx.select({ value: count() }).from(reviewReactions).where(eq(reviewReactions.reviewId, reviewId));
    return { loved: !existing, count: value };
  });
}

export async function publicReviews(productId?: string) {
  const condition = and(
    eq(reviews.status, "approved"),
    eq(reviews.isHidden, false),
    productId ? eq(reviews.productId, productId) : undefined,
  );
  return db
    .select({
      review: reviews,
      loveCount: count(reviewReactions.reviewId),
    })
    .from(reviews)
    .leftJoin(reviewReactions, eq(reviewReactions.reviewId, reviews.id))
    .where(condition)
    .groupBy(reviews.id)
    .orderBy(desc(reviews.createdAt));
}