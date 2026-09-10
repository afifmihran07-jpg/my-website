import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function signValue(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function recoveryCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () =>
    Array.from(randomBytes(4), (byte) => alphabet[byte % alphabet.length]).join(""),
  ).join("-");
}