import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import {
  sendPasswordResetEmail,
  normalizeEmail,
  RateLimitedError,
  SmtpNotConfiguredError,
} from "@/lib/password-reset";

/**
 * Validates the basic structure of an email address without regex.
 *
 * Checks that the string contains exactly one `@` with non-empty local and
 * domain parts, and that the domain has at least one dot after the `@`.
 *
 * @param email - The raw email string to validate.
 * @returns `true` if the string looks like a valid email.
 */
function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex < 1) { return false; }
  const dotIndex = trimmed.lastIndexOf(".");
  if (dotIndex <= atIndex + 1 || dotIndex === trimmed.length - 1) { return false; }
  return true;
}

/**
 * POST /api/auth/reset-password
 *
 * Accepts an email address and sends a password reset link if the account exists.
 * Always returns 200 for valid email format to prevent account enumeration (FR-003).
 */
export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return fail("INVALID_EMAIL", 400);
  }

  const { email } = body;

  if (!email || typeof email !== "string" || !isValidEmail(email)) {
    return fail("INVALID_EMAIL", 400);
  }

  const normalizedEmail = normalizeEmail(email);

  try {
    await sendPasswordResetEmail(normalizedEmail);
  } catch (error: unknown) {
    if (error instanceof RateLimitedError) {
      return fail("RATE_LIMITED", 429);
    }
    if (error instanceof SmtpNotConfiguredError) {
      return fail("INTERNAL_ERROR", 500);
    }
    console.error("[reset-password] unexpected error sending reset email", {
      email: normalizedEmail,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return ok({
    message: "If an account with this email exists, a password reset link has been sent.",
  });
}
