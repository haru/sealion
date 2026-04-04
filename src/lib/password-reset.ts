import { prisma } from "@/lib/db";
import { getSmtpSettings } from "@/lib/smtp-settings";
import { sendMail } from "@/lib/smtp-mailer";
import { generateToken, getAppBaseUrl } from "@/lib/email-verification";

const RATE_LIMIT_MS = 60_000;
const TOKEN_EXPIRY_HOURS = 24;

/** In-memory rate-limit tracker: email → timestamp of last request. */
const rateLimitMap = new Map<string, number>();

/**
 * Error thrown when a password reset request is rate-limited.
 */
export class RateLimitedError extends Error {
  constructor() {
    super("Rate limit exceeded");
    this.name = "RateLimitedError";
  }
}

/**
 * Error thrown when SMTP is not configured for the installation.
 */
export class SmtpNotConfiguredError extends Error {
  constructor() {
    super("SMTP not configured");
    this.name = "SmtpNotConfiguredError";
  }
}

/**
 * Checks whether the given email address is currently rate-limited.
 *
 * If the email was recently requested (within `RATE_LIMIT_MS`), records the
 * current time and returns `true`. Otherwise returns `false`.
 *
 * @param email - The email address to check.
 * @returns `true` if the request should be blocked, `false` otherwise.
 */
export function isRateLimited(email: string): boolean {
  const now = Date.now();
  const lastRequest = rateLimitMap.get(email);

  if (lastRequest !== undefined && now - lastRequest < RATE_LIMIT_MS) {
    return true;
  }

  rateLimitMap.set(email, now);
  return false;
}

/**
 * Sends a password reset email to the given address.
 *
 * Validates SMTP configuration and rate limiting before proceeding. If the
 * email has been requested recently (within 60 seconds), throws
 * {@link RateLimitedError}. Any existing password-reset tokens for the email
 * are deleted before creating a new one (FR-007).
 *
 * @param email - The recipient email address.
 * @throws {@link SmtpNotConfiguredError} When SMTP settings have not been configured.
 * @throws {@link RateLimitedError} When the email is rate-limited.
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  if (isRateLimited(email)) {
    throw new RateLimitedError();
  }

  const settings = await getSmtpSettings();
  if (!settings) {
    throw new SmtpNotConfiguredError();
  }

  const identifier = `password-reset:${email}`;

  await prisma.verificationToken.deleteMany({
    where: { identifier },
  });

  const token = generateToken();
  const expires = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.verificationToken.create({
    data: { identifier, token, expires },
  });

  const resetUrl = `${getAppBaseUrl()}/reset-password/confirm?token=${token}`;

  await sendMail({
    host: settings.host,
    port: settings.port,
    fromAddress: settings.fromAddress,
    fromName: settings.fromName,
    requireAuth: settings.requireAuth,
    username: settings.username,
    password: settings.encryptedPassword
      ? await decryptSmtpPassword(settings.encryptedPassword)
      : null,
    useTls: settings.useTls,
    to: email,
    subject: "Reset your password",
    text: `Please reset your password by clicking the following link:\n\n${resetUrl}\n\nIf you did not request a password reset, you can ignore this email.`,
  });
}

/**
 * Decrypts an SMTP password stored in the database.
 *
 * @param encrypted - The AES-256-GCM encrypted password string.
 * @returns The decrypted plaintext password.
 */
async function decryptSmtpPassword(encrypted: string): Promise<string> {
  const { decrypt } = await import("@/lib/encryption");
  return decrypt(encrypted);
}

/**
 * Error thrown when {@link verifyPasswordResetToken} encounters an expired token.
 */
export class TokenExpiredError extends Error {
  constructor() {
    super("Token expired");
    this.name = "TokenExpiredError";
  }
}

/**
 * Verifies a password reset token and returns the associated email.
 *
 * Looks up the token in the `VerificationToken` table. If the token exists and
 * has not expired, returns the email portion of the `identifier` field.
 *
 * @param token - The password reset token to validate.
 * @returns The email address associated with the token, or `null` if the token
 *   is missing or not found.
 * @throws {@link TokenExpiredError} When the token exists but has expired.
 */
export async function verifyPasswordResetToken(token: string): Promise<string | null> {
  if (!token) return null;

  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!record) return null;
  if (new Date() > record.expires) throw new TokenExpiredError();

  const prefix = "password-reset:";
  if (!record.identifier.startsWith(prefix)) return null;

  return record.identifier.slice(prefix.length);
}

/**
 * Consumes (deletes) a password reset token after it has been used.
 *
 * @param token - The token to delete.
 */
export async function consumePasswordResetToken(token: string): Promise<void> {
  await prisma.verificationToken.delete({
    where: { token },
  });
}
