import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import {
  sendPasswordResetEmail,
  RateLimitedError,
  SmtpNotConfiguredError,
} from "@/lib/password-reset";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email)) {
    return fail("INVALID_EMAIL", 400);
  }

  try {
    await sendPasswordResetEmail(email);
  } catch (error: unknown) {
    if (error instanceof RateLimitedError) {
      return fail("RATE_LIMITED", 429);
    }
    if (error instanceof SmtpNotConfiguredError) {
      return fail("INTERNAL_ERROR", 500);
    }
  }

  return ok({
    message: "If an account with this email exists, a password reset link has been sent.",
  });
}
