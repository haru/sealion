import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";
import { normalizeEmail, verifyPasswordResetToken, TokenExpiredError } from "@/lib/password-reset";

/**
 * POST /api/auth/reset-password/confirm
 *
 * Validates the password reset token, checks the user status, hashes the new
 * password with bcrypt (cost 12), updates the user record (including
 * `passwordChangedAt` for JWT session invalidation), and consumes the token.
 * The password update and token deletion are performed atomically within a
 * single database transaction.
 */
export async function POST(request: NextRequest) {
  let body: { token?: string; password?: string; confirmPassword?: string };
  try {
    body = await request.json();
  } catch {
    return fail("INVALID_INPUT", 400);
  }

  const { token, password, confirmPassword } = body;

  if (!token || typeof token !== "string") {
    return fail("MISSING_TOKEN", 400);
  }

  if (!password || typeof password !== "string") {
    return fail("PASSWORD_TOO_SHORT", 400);
  }

  if (password.length < 8) {
    return fail("PASSWORD_TOO_SHORT", 400);
  }

  if (password.length > 72) {
    return fail("PASSWORD_TOO_LONG", 400);
  }

  if (password !== confirmPassword) {
    return fail("PASSWORD_MISMATCH", 400);
  }

  let email: string | null;
  try {
    email = await verifyPasswordResetToken(token);
  } catch (error: unknown) {
    if (error instanceof TokenExpiredError) {
      return fail("EXPIRED_TOKEN", 410);
    }
    return fail("INVALID_TOKEN", 410);
  }

  if (!email) {
    return fail("INVALID_TOKEN", 410);
  }

  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, status: true },
  });

  if (!user) {
    return fail("NOT_FOUND", 404);
  }

  if (user.status === "SUSPENDED") {
    return fail("FORBIDDEN", 403);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        passwordChangedAt: new Date(),
      },
    }),
    prisma.verificationToken.deleteMany({
      where: { token },
    }),
  ]);

  return ok({ message: "Password has been reset successfully." });
}
