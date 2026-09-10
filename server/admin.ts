import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import {
  adminNotifications,
  businessSettings,
  categories,
  cmsDocuments,
  coupons,
  customers,
  orderItems,
  orders,
  productImages,
  products,
  productVariants,
  reviews,
} from "./db/schema";
import { sendTransactionalSms } from "./notifications";

export async function dashboardMetrics() {
  const [[orderCount], [productCount], [pendingCount], [revenue], lowStock, recentOrders, allOrders, allItems] = await Promise.all([
    db.select({ value: count() }).from(orders),
    db.select({ value: count() }).from(products),
    db.select({ value: count() }).from(orders).where(eq(orders.orderStatus, "pending")),
    db.select({ value: sql<number>`coalesce(sum(${orders.total}), 0)` }).from(orders).where(eq(orders.paymentStatus, "paid")),
    db.select().from(products).where(sql`${products.stock} <= 5`).orderBy(products.stock),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(10),
    db.select().from(orders),
    db.select().from(orderItems),
  ]);
  const realized = allOrders.filter((order) => order.paymentStatus === "paid" || order.orderStatus === "delivered");
  const productMap = new Map<string, { name: string; category: string; quantity: number; revenue: number }>();
  const sizeSalesMap: Record<string, number> = {};
  const colorSalesMap: Record<string, number> = {};
  const posterDimMap: Record<string, number> = {};
  for (const item of allItems) {
    const current = productMap.get(item.productId ?? item.productName) ?? { name: item.productName, category: item.category, quantity: 0, revenue: 0 };
    current.quantity += item.quantity;
    current.revenue += item.lineTotal;
    productMap.set(item.productId ?? item.productName, current);
    if (item.selectedSize) sizeSalesMap[item.selectedSize] = (sizeSalesMap[item.selectedSize] ?? 0) + item.quantity;
    if (item.selectedColor) colorSalesMap[item.selectedColor] = (colorSalesMap[item.selectedColor] ?? 0) + item.quantity;
    if (item.posterSize) posterDimMap[item.posterSize] = (posterDimMap[item.posterSize] ?? 0) + item.quantity;
  }
  const totalRevenue = realized.reduce((sum, order) => sum + order.total, 0);
  return {
    totalOrders: orderCount.value,
    totalProducts: productCount.value,
    pendingOrders: pendingCount.value,
    revenue: Number(revenue.value),
    lowStock,
    recentOrders,
    totalRevenue,
    totalOrderCount: allOrders.length,
    averageOrderValue: realized.length ? Math.round(totalRevenue / realized.length) : 0,
    topProducts: [...productMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    sizeSalesMap,
    colorSalesMap,
    posterDimMap,
    paymentBreakdown: {
      bkashCount: allOrders.filter((order) => order.paymentMethod === "bkash").length,
      bkashRevenue: allOrders.filter((order) => order.paymentMethod === "bkash").reduce((sum, order) => sum + order.total, 0),
      codCount: allOrders.filter((order) => order.paymentMethod === "cod").length,
      codRevenue: allOrders.filter((order) => order.paymentMethod === "cod").reduce((sum, order) => sum + order.total, 0),
    },
    lowStockProducts: lowStock,
  };
}

export async function upsertCategory(input: typeof categories.$inferInsert & { id?: string }) {
  if (input.id) {
    const [row] = await db.update(categories).set({ ...input, updatedAt: new Date() }).where(eq(categories.id, input.id)).returning();
    return row;
  }
  const [row] = await db.insert(categories).values(input).returning();
  return row;
}

export async function removeCategory(id: string) {
  const [{ value }] = await db.select({ value: count() }).from(products).where(eq(products.categoryId, id));
  if (value > 0) throw new Error("CATEGORY_HAS_PRODUCTS");
  await db.delete(categories).where(eq(categories.id, id));
}

export async function upsertProduct(input: {
  product: typeof products.$inferInsert & { id?: string };
  images?: Array<Omit<typeof productImages.$inferInsert, "productId">>;
  variants?: Array<Omit<typeof productVariants.$inferInsert, "productId">>;
}) {
  return db.transaction(async (tx) => {
    const { id, ...values } = input.product;
    const [product] = id
      ? await tx.update(products).set({ ...values, updatedAt: new Date() }).where(eq(products.id, id)).returning()
      : await tx.insert(products).values(values).returning();
    if (input.images) {
      await tx.delete(productImages).where(eq(productImages.productId, product.id));
      if (input.images.length) await tx.insert(productImages).values(input.images.map((image) => ({ ...image, productId: product.id })));
    }
    if (input.variants) {
      await tx.delete(productVariants).where(eq(productVariants.productId, product.id));
      if (input.variants.length) await tx.insert(productVariants).values(input.variants.map((variant) => ({ ...variant, productId: product.id })));
    }
    return product;
  });
}

export async function removeProduct(id: string) {
  await db.delete(products).where(eq(products.id, id));
}

export async function upsertCoupon(input: typeof coupons.$inferInsert & { id?: string }) {
  const { id, ...values } = input;
  if (id) {
    const [row] = await db.update(coupons).set({ ...values, updatedAt: new Date() }).where(eq(coupons.id, id)).returning();
    return row;
  }
  const [row] = await db.insert(coupons).values({ ...values, code: values.code.toUpperCase() }).returning();
  return row;
}

export async function removeCoupon(id: string) {
  await db.delete(coupons).where(eq(coupons.id, id));
}

export async function updateInventory(variantId: string, stock: number) {
  if (!Number.isInteger(stock) || stock < 0) throw new Error("INVALID_STOCK");
  const [row] = await db.update(productVariants).set({ stock, updatedAt: new Date() }).where(eq(productVariants.id, variantId)).returning();
  return row;
}

export async function updateOrderStatus(orderId: string, status: typeof orders.$inferInsert.orderStatus) {
  const row = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
    if (!existing) throw new Error("ORDER_NOT_FOUND");
    if (status === "cancelled" && existing.orderStatus !== "cancelled") {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, existing.id));
      for (const item of items) {
        if (item.variantId) {
          await tx.update(productVariants).set({ stock: sql`${productVariants.stock} + ${item.quantity}`, updatedAt: new Date() }).where(eq(productVariants.id, item.variantId));
        } else if (item.productId) {
          await tx.update(products).set({ stock: sql`${products.stock} + ${item.quantity}`, updatedAt: new Date() }).where(eq(products.id, item.productId));
        }
      }
    }
    const [updated] = await tx.update(orders).set({ orderStatus: status, updatedAt: new Date() }).where(eq(orders.id, orderId)).returning();
    return updated;
  });
  const messages: Partial<Record<NonNullable<typeof status>, string>> = {
    shipped: `Your HSS order ${row.orderNumber} has been shipped.`,
    delivered: `Your HSS order ${row.orderNumber} has been delivered.`,
    cancelled: `Your HSS order ${row.orderNumber} has been cancelled.`,
    refunded: `Your HSS order ${row.orderNumber} refund has been processed.`,
  };
  if (messages[status!]) {
    void sendTransactionalSms({ orderId: row.id, phone: row.phone, template: `order_${status}`, message: messages[status!]! });
  }
  return row;
}

export async function setReviewModeration(
  id: string,
  input: { status?: typeof reviews.$inferInsert.status; isHidden?: boolean; featuredOnHomepage?: boolean },
) {
  const [row] = await db.update(reviews).set({ ...input, updatedAt: new Date() }).where(eq(reviews.id, id)).returning();
  return row;
}

export async function saveCms(key: string, content: Record<string, unknown>, publish: boolean) {
  const [existing] = await db.select().from(cmsDocuments).where(eq(cmsDocuments.key, key)).limit(1);
  const values = publish
    ? { publishedContent: content, draftContent: content, publishedAt: new Date(), updatedAt: new Date() }
    : { draftContent: content, updatedAt: new Date() };
  if (existing) {
    const [row] = await db.update(cmsDocuments).set(values).where(eq(cmsDocuments.id, existing.id)).returning();
    return row;
  }
  const [row] = await db.insert(cmsDocuments).values({ key, draftContent: content, publishedContent: publish ? content : {}, publishedAt: publish ? new Date() : null }).returning();
  return row;
}

export async function saveSetting(key: string, value: unknown, isSecret = false) {
  const [existing] = await db.select().from(businessSettings).where(eq(businessSettings.key, key)).limit(1);
  if (existing) {
    const [row] = await db.update(businessSettings).set({ value, isSecret, updatedAt: new Date() }).where(eq(businessSettings.id, existing.id)).returning();
    return row;
  }
  const [row] = await db.insert(businessSettings).values({ key, value, isSecret }).returning();
  return row;
}

export async function allAdminData(resource: string) {
  switch (resource) {
    case "products": return db.select().from(products).orderBy(desc(products.createdAt));
    case "categories": return db.select().from(categories).orderBy(categories.sortOrder);
    case "orders": return db.select().from(orders).orderBy(desc(orders.createdAt));
    case "customers": return db.select().from(customers).orderBy(desc(customers.createdAt));
    case "coupons": return db.select().from(coupons).orderBy(desc(coupons.createdAt));
    case "reviews": return db.select().from(reviews).orderBy(desc(reviews.createdAt));
    case "notifications": return db.select().from(adminNotifications).orderBy(desc(adminNotifications.createdAt));
    case "settings": return db.select().from(businessSettings).where(eq(businessSettings.isSecret, false));
    case "cms": return db.select().from(cmsDocuments).orderBy(cmsDocuments.key);
    default: throw new Error("UNKNOWN_RESOURCE");
  }
}