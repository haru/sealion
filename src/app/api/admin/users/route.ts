import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";
import { hash } from "bcryptjs";
import { UserRole } from "@prisma/client";

/** Verifies the current session belongs to an admin user. */
async function requireAdmin() {
  const session = await auth();
  if (!session) return { error: fail("UNAUTHORIZED", 401), session: null };
  if (session.user.role !== "ADMIN") return { error: fail("FORBIDDEN", 403), session: null };
  return { error: null, session };
}

/**
 * GET /api/admin/users — Returns all users (admin only).
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const users = await prisma.user.findMany({
    select: { id: true, email: true, username: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return ok(users);
}

/**
 * POST /api/admin/users — Creates a new user (admin only).
 */
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body) return fail("INVALID_BODY", 400);

  const { email, password, role } = body as {
    email: string;
    password: string;
    role?: string;
    username?: string;
  };
  const username = typeof body.username === "string" && body.username.trim() ? body.username.trim() : undefined;

  if (!email || !password) return fail("MISSING_FIELDS", 400);
  if (password.length < 8) return fail("PASSWORD_TOO_SHORT", 400);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return fail("EMAIL_ALREADY_EXISTS", 409);

  const userRole =
    role && Object.values(UserRole).includes(role as UserRole) ? (role as UserRole) : UserRole.USER;

  const hashedPassword = await hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash: hashedPassword, role: userRole, ...(username !== undefined ? { username } : {}) },
    select: { id: true, email: true, username: true, role: true, createdAt: true },
  });

  return ok(user, 201);
}
