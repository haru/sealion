import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getSmtpSettings } from "@/lib/smtp-settings";
import { sendMail } from "@/lib/smtp-mailer";
import type { UserStatus } from "@prisma/client";

/**
 * Returns the application base URL for constructing absolute links.
 *
 * Prefers `AUTH_URL`, then `NEXTAUTH_URL`, then falls back to `http://localhost:3000`.
 * Use this as the single source of truth for base URL resolution wherever an
 * absolute URL must be constructed (e.g. email links, redirect targets).
 *
 * @returns The base URL string without a trailing slash.
 */
export function getAppBaseUrl(): string {
  return (
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
  );
}

/**
 * Generates a cryptographically random 64-character hex string for email verification tokens.
 *
 * @returns A 64-character lowercase hex string (32 bytes of randomness).
 */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Sends a verification email to the given address with a link containing the token.
 *
 * Constructs the verification URL using {@link getAppBaseUrl}.
 * If SMTP settings have not been configured by the admin, logs a warning and returns
 * without throwing.
 *
 * @param email - The recipient email address.
 * @param token - The verification token to include in the link.
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<void> {
  const settings = await getSmtpSettings();
  if (!settings) {
    console.warn(
      "SMTP settings not configured. Skipping verification email.",
    );
    return;
  }

  const verifyUrl = `${getAppBaseUrl()}/api/auth/confirm?token=${token}`;

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
    subject: "Verify your email address",
    text: `Please verify your email address by clicking the following link:\n\n${verifyUrl}\n\nIf you did not create an account, you can ignore this email.`,
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
 * Error thrown by {@link verifyToken} when the token has expired.
 */
export class TokenExpiredError extends Error {
  constructor() {
    super("Token expired");
    this.name = "TokenExpiredError";
  }
}

/**
 * Verifies an email verification token and returns the matching user if valid.
 *
 * Looks up a user by `emailVerificationToken`. If found and the token has not expired
 * (within 24 hours of issuance), returns the user's id, email, and status.
 *
 * @param token - The email verification token to validate.
 * @returns An object with `id`, `email`, and `status` if valid, or `null` if the token
 *   is absent or does not match any user.
 * @throws {@link TokenExpiredError} When the token exists but has expired.
 */
export async function verifyToken(
  token: string,
): Promise<{ id: string; email: string; status: UserStatus } | null> {
  if (!token) return null;

  const user = await prisma.user.findUnique({
    where: { emailVerificationToken: token },
    select: {
      id: true,
      email: true,
      status: true,
      emailVerificationToken: true,
      emailVerificationTokenExpires: true,
    },
  });

  if (!user) return null;
  if (!user.emailVerificationTokenExpires) return null;
  if (new Date() > user.emailVerificationTokenExpires) throw new TokenExpiredError();

  return { id: user.id, email: user.email, status: user.status };
}
