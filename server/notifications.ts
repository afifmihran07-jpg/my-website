import nodemailer from "nodemailer";
import { db } from "./db/index.js";
import { notifications } from "./db/schema.js";
import { env } from "./env.js";

type SmsResult = {
  status: "sent" | "failed" | "unconfigured";
  provider?: string;
  providerMessageId?: string;
  error?: string;
};

export async function sendTransactionalSms(input: {
  orderId?: string;
  customerId?: string;
  phone: string;
  template: string;
  message: string;
}): Promise<SmsResult> {
  const config = env();
  let result: SmsResult;

  if (config.SMS_PROVIDER === "unconfigured" || !config.SMS_API_URL || !config.SMS_API_KEY) {
    result = { status: "unconfigured", error: "SMS provider credentials are not configured" };
  } else {
    try {
      const response = await fetch(config.SMS_API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.SMS_API_KEY}`,
        },
        body: JSON.stringify({
          to: input.phone,
          message: input.message,
          senderId: config.SMS_SENDER_ID,
        }),
      });
      if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
      const body = (await response.json()) as { id?: string; messageId?: string };
      result = {
        status: "sent",
        provider: config.SMS_PROVIDER,
        providerMessageId: body.id ?? body.messageId,
      };
    } catch (error) {
      result = {
        status: "failed",
        provider: config.SMS_PROVIDER,
        error: error instanceof Error ? error.message : "Unknown provider failure",
      };
    }
  }

  await db.insert(notifications).values({
    orderId: input.orderId,
    customerId: input.customerId,
    channel: "sms",
    destination: input.phone,
    template: input.template,
    message: input.message,
    status: result.status,
    provider: result.provider,
    providerMessageId: result.providerMessageId,
    errorMessage: result.error,
    sentAt: result.status === "sent" ? new Date() : null,
  });

  return result;
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const config = env();
  if (!config.SMTP_HOST || !config.SMTP_PORT || !config.SMTP_USER || !config.SMTP_PASSWORD || !config.SMTP_FROM) {
    return { status: "unconfigured" as const };
  }
  const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD },
  });
  await transporter.sendMail({
    from: config.SMTP_FROM,
    to: email,
    subject: "High Street Society admin password reset",
    text: `A password reset was requested for HSS Admin. This single-use link expires in 15 minutes:\n\n${resetUrl}\n\nIf you did not request it, ignore this email.`,
  });
  return { status: "sent" as const };
}