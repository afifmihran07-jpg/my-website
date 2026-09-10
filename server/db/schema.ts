import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const setupStateEnum = pgEnum("setup_state", [
  "INITIAL_SETUP_REQUIRED",
  "INITIAL_SETUP_IN_PROGRESS",
  "INITIAL_SETUP_COMPLETED",
]);
export const categoryVariantEnum = pgEnum("category_variant_type", ["clothing", "posters", "standard"]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refund_requested",
  "refunded",
]);
export const paymentMethodEnum = pgEnum("payment_method", ["cod", "bkash", "nagad"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending_verification",
  "pending",
  "paid",
  "rejected",
  "refunded",
]);
export const couponTypeEnum = pgEnum("coupon_type", ["percentage", "fixed"]);
export const reviewStatusEnum = pgEnum("review_status", ["pending", "approved", "rejected"]);
export const notificationStatusEnum = pgEnum("notification_status", [
  "queued",
  "sent",
  "failed",
  "unconfigured",
]);

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  recoveryEmail: text("recovery_email").notNull(),
  recoveryCodeHash: text("recovery_code_hash"),
  setupState: setupStateEnum("setup_state").notNull().default("INITIAL_SETUP_REQUIRED"),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("admin_users_username_uidx").on(table.username)]);

export const adminSessions = pgTable("admin_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: uuid("admin_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("admin_sessions_token_uidx").on(table.tokenHash)]);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: uuid("admin_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("password_reset_token_uidx").on(table.tokenHash)]);

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  variantType: categoryVariantEnum("variant_type").notNull().default("standard"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("categories_slug_uidx").on(table.slug)]);

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id").notNull().references(() => categories.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  tagline: text("tagline").notNull().default(""),
  description: text("description").notNull().default(""),
  details: jsonb("details").$type<string[]>().notNull().default([]),
  fabric: text("fabric"),
  sku: text("sku").notNull(),
  price: integer("price").notNull(),
  compareAtPrice: integer("compare_at_price"),
  stock: integer("stock").notNull().default(0),
  isNewDrop: boolean("is_new_drop").notNull().default(false),
  isFeatured: boolean("is_featured").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(true),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("products_slug_uidx").on(table.slug),
  uniqueIndex("products_sku_uidx").on(table.sku),
  index("products_category_idx").on(table.categoryId),
]);

export const productImages = pgTable("product_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  publicId: text("public_id"),
  altText: text("alt_text").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("product_images_product_idx").on(table.productId)]);

export const productVariants = pgTable("product_variants", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  sku: text("sku").notNull(),
  size: text("size"),
  colorName: text("color_name"),
  colorHex: text("color_hex"),
  posterSizeName: text("poster_size_name"),
  width: numeric("width", { precision: 8, scale: 2 }),
  height: numeric("height", { precision: 8, scale: 2 }),
  unit: text("unit"),
  price: integer("price"),
  stock: integer("stock").notNull().default(0),
  reservedStock: integer("reserved_stock").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("product_variants_sku_uidx").on(table.sku),
  index("product_variants_product_idx").on(table.productId),
]);

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  passwordHash: text("password_hash"),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("customers_phone_uidx").on(table.phone),
  uniqueIndex("customers_email_uidx").on(table.email),
]);

export const customerAddresses = pgTable("customer_addresses", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  recipientName: text("recipient_name").notNull(),
  phone: text("phone").notNull(),
  district: text("district").notNull(),
  area: text("area"),
  address: text("address").notNull(),
  deliveryLocation: text("delivery_location").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customerSessions = pgTable("customer_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("customer_sessions_token_uidx").on(table.tokenHash)]);

export const coupons = pgTable("coupons", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull(),
  type: couponTypeEnum("type").notNull(),
  value: integer("value").notNull(),
  minOrderValue: integer("min_order_value"),
  maxDiscount: integer("max_discount"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  usageLimit: integer("usage_limit"),
  perCustomerLimit: integer("per_customer_limit"),
  firstOrderOnly: boolean("first_order_only").notNull().default(false),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("coupons_code_uidx").on(table.code)]);

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderNumber: text("order_number").notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  customerName: text("customer_name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  district: text("district").notNull(),
  area: text("area"),
  address: text("address").notNull(),
  deliveryLocation: text("delivery_location").notNull(),
  subtotal: integer("subtotal").notNull(),
  discount: integer("discount").notNull().default(0),
  deliveryCharge: integer("delivery_charge").notNull(),
  total: integer("total").notNull(),
  couponId: uuid("coupon_id").references(() => coupons.id, { onDelete: "set null" }),
  couponCode: text("coupon_code"),
  couponType: couponTypeEnum("coupon_type"),
  couponValue: integer("coupon_value"),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  paymentStatus: paymentStatusEnum("payment_status").notNull(),
  transactionId: text("transaction_id"),
  orderStatus: orderStatusEnum("order_status").notNull().default("pending"),
  courierName: text("courier_name"),
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  notes: text("notes"),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("orders_number_uidx").on(table.orderNumber),
  uniqueIndex("orders_idempotency_uidx").on(table.idempotencyKey),
  index("orders_customer_idx").on(table.customerId),
  index("orders_transaction_idx").on(table.transactionId),
]);

export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  sku: text("sku"),
  imageUrl: text("image_url"),
  category: text("category").notNull(),
  unitPrice: integer("unit_price").notNull(),
  quantity: integer("quantity").notNull(),
  selectedSize: text("selected_size"),
  selectedColor: text("selected_color"),
  posterSize: text("poster_size"),
  posterDimensions: text("poster_dimensions"),
  lineTotal: integer("line_total").notNull(),
});

export const couponUsages = pgTable("coupon_usages", {
  id: uuid("id").defaultRandom().primaryKey(),
  couponId: uuid("coupon_id").notNull().references(() => coupons.id, { onDelete: "cascade" }),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  customerPhone: text("customer_phone").notNull(),
  discountAmount: integer("discount_amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("coupon_usage_order_uidx").on(table.orderId)]);

export const paymentVerifications = pgTable("payment_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  adminId: uuid("admin_id").notNull().references(() => adminUsers.id, { onDelete: "restrict" }),
  previousStatus: paymentStatusEnum("previous_status").notNull(),
  newStatus: paymentStatusEnum("new_status").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  customerName: text("customer_name").notNull(),
  rating: integer("rating").notNull(),
  reviewText: text("review_text").notNull(),
  verifiedPurchase: boolean("verified_purchase").notNull().default(false),
  status: reviewStatusEnum("status").notNull().default("pending"),
  isHidden: boolean("is_hidden").notNull().default(false),
  featuredOnHomepage: boolean("featured_on_homepage").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reviewReactions = pgTable("review_reactions", {
  reviewId: uuid("review_id").notNull().references(() => reviews.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  sessionHash: text("session_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.reviewId, table.sessionHash] }),
  index("review_reactions_review_idx").on(table.reviewId),
]);

export const cmsDocuments = pgTable("cms_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull(),
  draftContent: jsonb("draft_content").$type<Record<string, unknown>>().notNull().default({}),
  publishedContent: jsonb("published_content").$type<Record<string, unknown>>().notNull().default({}),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("cms_documents_key_uidx").on(table.key)]);

export const businessSettings = pgTable("business_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull(),
  value: jsonb("value").$type<unknown>().notNull(),
  isSecret: boolean("is_secret").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("business_settings_key_uidx").on(table.key)]);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  channel: text("channel").notNull(),
  destination: text("destination").notNull(),
  template: text("template").notNull(),
  message: text("message").notNull(),
  status: notificationStatusEnum("status").notNull(),
  provider: text("provider"),
  providerMessageId: text("provider_message_id"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminNotifications = pgTable("admin_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  consentedAt: timestamp("consented_at", { withTimezone: true }).notNull().defaultNow(),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
}, (table) => [uniqueIndex("newsletter_email_uidx").on(table.email)]);

export const wishlistItems = pgTable("wishlist_items", {
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.customerId, table.productId] })]);

export const abandonedCarts = pgTable("abandoned_carts", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: text("session_id").notNull(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  items: jsonb("items").$type<Array<Record<string, unknown>>>().notNull().default([]),
  subtotal: integer("subtotal").notNull().default(0),
  convertedOrderId: uuid("converted_order_id").references(() => orders.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("abandoned_carts_session_uidx").on(table.sessionId)]);