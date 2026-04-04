import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getAuthSettings } from "@/lib/auth-settings";
import { generateToken, sendVerificationEmail } from "@/lib/email-verification";
import { ok, fail } from "@/lib/api-response";

/**
 * Returns true if the string matches a basic email format.
 * @param email - The email address to validate.
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * POST /api/auth/signup — Registers a new user account.
 *
 * Returns 403 SIGNUP_DISABLED when user signup has been disabled by an administrator.
 * When email verification is required, creates the user with status PENDING and
 * sends a verification email.
 *
 * @param request - The incoming registration request.
 * @returns 201 with created user, or an appropriate error response.
 */
export async function POST(request: NextRequest) {
  const settings = await getAuthSettings();
  if (!settings.allowUserSignup) {
    return fail("SIGNUP_DISABLED", 403);
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return fail("INVALID_INPUT", 400);
  }

  const email = (body.email as string).trim().toLowerCase();
  const password = body.password as string;
  const username = typeof body.username === "string" ? body.username.trim() : "";

  if (!username) {
    return fail("MISSING_USERNAME", 400);
  }

  if (!isValidEmail(email)) {
    return fail("INVALID_EMAIL", 400);
  }

  if (password.length < 8) {
    return fail("PASSWORD_TOO_SHORT", 400);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return fail("EMAIL_ALREADY_EXISTS", 409);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  if (settings.requireEmailVerification) {
    const token = generateToken();
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        username,
        status: "PENDING",
        emailVerificationToken: token,
        emailVerificationTokenExpires: tokenExpires,
      },
      select: { id: true, email: true, role: true },
    });

    try {
      await sendVerificationEmail(email, token);
    } catch (error) {
      console.error("Failed to send verification email during signup.", {
        email,
        userId: user.id,
        error,
      });

      try {
        await prisma.user.delete({ where: { id: user.id } });
      } catch (rollbackError) {
        console.error(
          "Failed to roll back pending user after verification email failure.",
          { email, userId: user.id, error: rollbackError },
        );
      }

      return fail("VERIFICATION_EMAIL_SEND_FAILED", 503);
    }

    return ok({ ...user, verificationRequired: true }, 201);
  }

  const user = await prisma.user.create({
    data: { email, passwordHash, username, status: "ACTIVE" },
    select: { id: true, email: true, role: true },
  });

  return ok(user, 201);
}
