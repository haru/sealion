import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";

/** Maximum password length before bcrypt silently truncates input. */
const MAX_PASSWORD_LENGTH = 72;

/**
 * Returns true when the string matches a basic email format.
 * @param email - The email address to validate.
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * POST /api/auth/setup — Creates the first administrator account.
 *
 * Only succeeds when the `User` table is empty. Returns 403 if any user
 * already exists, preventing re-use of the setup endpoint after initial
 * configuration. On concurrent requests, the second caller receives 409
 * due to the unique email constraint (detected via Prisma error code P2002).
 *
 * @param request - Incoming Next.js request with JSON body `{ email, password }`.
 * @returns 201 with `{ id, email, role: "ADMIN" }` on success, or an error response.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return fail("INVALID_INPUT", 400);
  }

  const email = (body.email as string).trim().toLowerCase();
  const password = body.password as string;

  if (!isValidEmail(email)) {
    return fail("INVALID_EMAIL", 400);
  }

  if (password.length < 8) {
    return fail("PASSWORD_TOO_SHORT", 400);
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return fail("PASSWORD_TOO_LONG", 400);
  }

  const count = await prisma.user.count();
  if (count > 0) {
    return fail("SETUP_ALREADY_DONE", 403);
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, role: "ADMIN" },
      select: { id: true, email: true, role: true },
    });
    return ok(user, 201);
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return fail("EMAIL_ALREADY_EXISTS", 409);
    }
    return fail("INTERNAL_ERROR", 500);
  }
}
