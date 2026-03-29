import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
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
 */
export async function POST(request: NextRequest) {
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
  const user = await prisma.user.create({
    data: { email, passwordHash, username },
    select: { id: true, email: true, role: true },
  });

  return ok(user, 201);
}
