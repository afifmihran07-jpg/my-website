import bcrypt from "bcryptjs";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "./db";
import { customerAddresses, customerSessions, customers, wishlistItems } from "./db/schema";
import { randomToken, sha256 } from "./crypto";
import { ApiRequest, ApiResponse, clearCookie, parseCookies, setCookie } from "./http";

const COOKIE = "hss_customer_session";

async function newSession(customerId: string, res: ApiResponse) {
  const raw = randomToken();
  await db.insert(customerSessions).values({
    customerId,
    tokenHash: sha256(raw),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
  });
  setCookie(res, COOKIE, raw, { maxAge: 30 * 24 * 60 * 60 });
}

export async function currentCustomer(req: ApiRequest) {
  const raw = parseCookies(req)[COOKIE];
  if (!raw) return null;
  const [result] = await db
    .select({ customer: customers })
    .from(customerSessions)
    .innerJoin(customers, eq(customerSessions.customerId, customers.id))
    .where(and(eq(customerSessions.tokenHash, sha256(raw)), gt(customerSessions.expiresAt, new Date()), isNull(customerSessions.revokedAt)))
    .limit(1);
  if (!result) return null;
  const [addresses, wishlist] = await Promise.all([
    db.select().from(customerAddresses).where(eq(customerAddresses.customerId, result.customer.id)),
    db.select().from(wishlistItems).where(eq(wishlistItems.customerId, result.customer.id)),
  ]);
  return {
    id: result.customer.id,
    fullName: result.customer.name,
    email: result.customer.email ?? "",
    phone: result.customer.phone,
    savedAddresses: addresses,
    wishlist: wishlist.map((item) => item.productId),
    createdAt: result.customer.createdAt,
    updatedAt: result.customer.updatedAt,
  };
}

export async function registerCustomer(
  res: ApiResponse,
  input: { fullName: string; email: string; phone: string; password: string },
) {
  const existing = await db
    .select({ id: customers.id })
    .from(customers)
    .where(or(eq(customers.phone, input.phone), eq(customers.email, input.email.toLowerCase())))
    .limit(1);
  if (existing.length) throw new Error("CUSTOMER_ALREADY_EXISTS");
  const [customer] = await db
    .insert(customers)
    .values({
      name: input.fullName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      passwordHash: await bcrypt.hash(input.password, 12),
    })
    .returning();
  await newSession(customer.id, res);
  return customer;
}

export async function loginCustomer(res: ApiResponse, identity: string, password: string) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(or(eq(customers.email, identity.toLowerCase()), eq(customers.phone, identity)))
    .limit(1);
  if (!customer?.passwordHash || !(await bcrypt.compare(password, customer.passwordHash))) throw new Error("INVALID_CUSTOMER_CREDENTIALS");
  await newSession(customer.id, res);
  return customer;
}

export async function logoutCustomer(req: ApiRequest, res: ApiResponse) {
  const raw = parseCookies(req)[COOKIE];
  if (raw) await db.update(customerSessions).set({ revokedAt: new Date() }).where(eq(customerSessions.tokenHash, sha256(raw)));
  clearCookie(res, COOKIE);
}

export async function saveAddress(req: ApiRequest, input: typeof customerAddresses.$inferInsert) {
  const customer = await currentCustomer(req);
  if (!customer) throw new Error("UNAUTHORIZED");
  const [address] = await db.insert(customerAddresses).values({ ...input, customerId: customer.id }).returning();
  return address;
}

export async function toggleWishlist(req: ApiRequest, productId: string) {
  const customer = await currentCustomer(req);
  if (!customer) throw new Error("UNAUTHORIZED");
  const [existing] = await db
    .select()
    .from(wishlistItems)
    .where(and(eq(wishlistItems.customerId, customer.id), eq(wishlistItems.productId, productId)))
    .limit(1);
  if (existing) {
    await db.delete(wishlistItems).where(and(eq(wishlistItems.customerId, customer.id), eq(wishlistItems.productId, productId)));
  } else {
    await db.insert(wishlistItems).values({ customerId: customer.id, productId });
  }
  return { saved: !existing };
}