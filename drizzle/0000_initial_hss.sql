CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SEQUENCE IF NOT EXISTS "hss_order_number_seq" START 100001;

CREATE SEQUENCE IF NOT EXISTS "hss_order_number_seq" START 100001;

CREATE TYPE "setup_state" AS ENUM ('INITIAL_SETUP_REQUIRED','INITIAL_SETUP_IN_PROGRESS','INITIAL_SETUP_COMPLETED');
CREATE TYPE "category_variant_type" AS ENUM ('clothing','posters','standard');
CREATE TYPE "order_status" AS ENUM ('pending','confirmed','processing','shipped','delivered','cancelled','refund_requested','refunded');
CREATE TYPE "payment_method" AS ENUM ('cod','bkash','nagad');
CREATE TYPE "payment_status" AS ENUM ('pending_verification','pending','paid','rejected','refunded');
CREATE TYPE "coupon_type" AS ENUM ('percentage','fixed');
CREATE TYPE "review_status" AS ENUM ('pending','approved','rejected');
CREATE TYPE "notification_status" AS ENUM ('queued','sent','failed','unconfigured');

CREATE TABLE "admin_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "username" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL, "recovery_email" text NOT NULL, "recovery_code_hash" text,
  "setup_state" setup_state NOT NULL DEFAULT 'INITIAL_SETUP_REQUIRED', "failed_login_attempts" integer NOT NULL DEFAULT 0,
  "locked_until" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "admin_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "admin_id" uuid NOT NULL REFERENCES "admin_users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE, "expires_at" timestamptz NOT NULL, "revoked_at" timestamptz,
  "ip_address" text, "user_agent" text, "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "password_reset_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "admin_id" uuid NOT NULL REFERENCES "admin_users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE, "expires_at" timestamptz NOT NULL, "used_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "name" text NOT NULL, "slug" text NOT NULL UNIQUE,
  "description" text, "variant_type" category_variant_type NOT NULL DEFAULT 'standard', "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "category_id" uuid NOT NULL REFERENCES "categories"("id") ON DELETE RESTRICT,
  "name" text NOT NULL, "slug" text NOT NULL UNIQUE, "tagline" text NOT NULL DEFAULT '', "description" text NOT NULL DEFAULT '',
  "details" jsonb NOT NULL DEFAULT '[]', "fabric" text, "sku" text NOT NULL UNIQUE, "price" integer NOT NULL,
  "compare_at_price" integer, "stock" integer NOT NULL DEFAULT 0 CHECK ("stock" >= 0),
  "is_new_drop" boolean NOT NULL DEFAULT false, "is_featured" boolean NOT NULL DEFAULT false, "is_published" boolean NOT NULL DEFAULT true,
  "seo_title" text, "seo_description" text, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "products_category_idx" ON "products" ("category_id");
CREATE TABLE "product_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "url" text NOT NULL, "public_id" text, "alt_text" text NOT NULL, "sort_order" integer NOT NULL DEFAULT 0,
  "is_primary" boolean NOT NULL DEFAULT false, "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "product_variants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "sku" text NOT NULL UNIQUE, "size" text, "color_name" text, "color_hex" text, "poster_size_name" text,
  "width" numeric(8,2), "height" numeric(8,2), "unit" text, "price" integer,
  "stock" integer NOT NULL DEFAULT 0 CHECK ("stock" >= 0), "reserved_stock" integer NOT NULL DEFAULT 0 CHECK ("reserved_stock" >= 0),
  "is_active" boolean NOT NULL DEFAULT true, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "product_variants_product_idx" ON "product_variants" ("product_id");
CREATE TABLE "customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "name" text NOT NULL, "email" text UNIQUE, "phone" text NOT NULL UNIQUE,
  "password_hash" text, "marketing_consent" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "customer_addresses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "label" text NOT NULL, "recipient_name" text NOT NULL, "phone" text NOT NULL, "district" text NOT NULL, "area" text,
  "address" text NOT NULL, "delivery_location" text NOT NULL, "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "customer_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE, "expires_at" timestamptz NOT NULL, "revoked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "coupons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "code" text NOT NULL UNIQUE, "type" coupon_type NOT NULL,
  "value" integer NOT NULL, "min_order_value" integer, "max_discount" integer, "starts_at" timestamptz, "ends_at" timestamptz,
  "usage_limit" integer, "per_customer_limit" integer, "first_order_only" boolean NOT NULL DEFAULT false,
  "category_id" uuid REFERENCES "categories"("id") ON DELETE SET NULL, "product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,
  "is_active" boolean NOT NULL DEFAULT true, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "order_number" text NOT NULL UNIQUE,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL, "customer_name" text NOT NULL, "email" text,
  "phone" text NOT NULL, "district" text NOT NULL, "area" text, "address" text NOT NULL, "delivery_location" text NOT NULL,
  "subtotal" integer NOT NULL, "discount" integer NOT NULL DEFAULT 0, "delivery_charge" integer NOT NULL, "total" integer NOT NULL,
  "coupon_id" uuid REFERENCES "coupons"("id") ON DELETE SET NULL, "coupon_code" text, "coupon_type" coupon_type, "coupon_value" integer,
  "payment_method" payment_method NOT NULL, "payment_status" payment_status NOT NULL, "transaction_id" text,
  "order_status" order_status NOT NULL DEFAULT 'pending', "courier_name" text, "tracking_number" text, "tracking_url" text,
  "notes" text, "idempotency_key" text NOT NULL UNIQUE, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "orders_transaction_idx" ON "orders" ("transaction_id");
CREATE TABLE "order_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL, "variant_id" uuid REFERENCES "product_variants"("id") ON DELETE SET NULL,
  "product_name" text NOT NULL, "sku" text, "image_url" text, "category" text NOT NULL, "unit_price" integer NOT NULL,
  "quantity" integer NOT NULL CHECK ("quantity" > 0), "selected_size" text, "selected_color" text, "poster_size" text,
  "poster_dimensions" text, "line_total" integer NOT NULL
);
CREATE TABLE "coupon_usages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "coupon_id" uuid NOT NULL REFERENCES "coupons"("id") ON DELETE CASCADE,
  "order_id" uuid NOT NULL UNIQUE REFERENCES "orders"("id") ON DELETE CASCADE,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL, "customer_phone" text NOT NULL,
  "discount_amount" integer NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "payment_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "admin_id" uuid NOT NULL REFERENCES "admin_users"("id") ON DELETE RESTRICT,
  "previous_status" payment_status NOT NULL, "new_status" payment_status NOT NULL, "note" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL, "customer_name" text NOT NULL,
  "rating" integer NOT NULL CHECK ("rating" BETWEEN 1 AND 5), "review_text" text NOT NULL,
  "verified_purchase" boolean NOT NULL DEFAULT false, "status" review_status NOT NULL DEFAULT 'pending',
  "is_hidden" boolean NOT NULL DEFAULT false, "featured_on_homepage" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "review_reactions" (
  "review_id" uuid NOT NULL REFERENCES "reviews"("id") ON DELETE CASCADE,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE CASCADE,
  "session_hash" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("review_id", "session_hash")
);
CREATE TABLE "cms_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "key" text NOT NULL UNIQUE,
  "draft_content" jsonb NOT NULL DEFAULT '{}', "published_content" jsonb NOT NULL DEFAULT '{}',
  "published_at" timestamptz, "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "business_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "key" text NOT NULL UNIQUE, "value" jsonb NOT NULL,
  "is_secret" boolean NOT NULL DEFAULT false, "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "order_id" uuid REFERENCES "orders"("id") ON DELETE CASCADE,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL, "channel" text NOT NULL,
  "destination" text NOT NULL, "template" text NOT NULL, "message" text NOT NULL,
  "status" notification_status NOT NULL, "provider" text, "provider_message_id" text, "error_message" text,
  "sent_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "admin_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "order_id" uuid REFERENCES "orders"("id") ON DELETE CASCADE,
  "type" text NOT NULL, "message" text NOT NULL, "is_read" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "newsletter_subscribers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "email" text NOT NULL UNIQUE,
  "consented_at" timestamptz NOT NULL DEFAULT now(), "unsubscribed_at" timestamptz
);
CREATE TABLE "wishlist_items" (
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("customer_id", "product_id")
);
CREATE TABLE "abandoned_carts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "session_id" text NOT NULL UNIQUE,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL, "customer_email" text, "customer_phone" text,
  "items" jsonb NOT NULL DEFAULT '[]', "subtotal" integer NOT NULL DEFAULT 0,
  "converted_order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL, "updated_at" timestamptz NOT NULL DEFAULT now()
);