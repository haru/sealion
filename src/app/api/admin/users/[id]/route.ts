import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";
import { hash } from "bcryptjs";
import { UserRole } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/users/[id] — Update a user's fields (admin only).
 *
 * Self-protection rules:
 * - Admin cannot change their own `role` (403 CANNOT_CHANGE_OWN_ROLE).
 * - Admin cannot deactivate their own account (403 CANNOT_DEACTIVATE_SELF).
 * - All other self-edits (email, username, password) are permitted.
 *
 * @param req - Incoming request with optional body fields: isActive, role, email, username, password.
 * @param params - Route params containing the target user id.
 * @returns Updated user data on success, or an error response.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);
  if (session.user.role !== "ADMIN") return fail("FORBIDDEN", 403);

  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return fail("INVALID_BODY", 400);

  const { isActive, role, email, username, password } = body as {
    isActive?: boolean;
    role?: string;
    email?: string;
    username?: string;
    password?: string;
  };

  // Self-protection: cannot change own role
  if (id === session.user.id && role !== undefined) {
    return fail("CANNOT_CHANGE_OWN_ROLE", 403);
  }

  // Self-protection: cannot deactivate own account
  if (id === session.user.id && isActive === false) {
    return fail("CANNOT_DEACTIVATE_SELF", 403);
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return fail("NOT_FOUND", 404);

  const updateData: Record<string, unknown> = {};
  if (typeof isActive === "boolean") updateData.isActive = isActive;
  if (role && Object.values(UserRole).includes(role as UserRole)) updateData.role = role;
  if (typeof email === "string" && email.trim()) updateData.email = email.trim().toLowerCase();
  if (typeof username === "string") updateData.username = username.trim();
  if (typeof password === "string" && password.length >= 8) {
    updateData.passwordHash = await hash(password, 12);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, email: true, username: true, role: true, isActive: true },
  });

  return ok(updated);
}

/**
 * DELETE /api/admin/users/[id] — Deletes a user and all associated data (admin only).
 *
 * Cascade delete order (matches Prisma relation constraints):
 * Issue → Project → IssueProvider → BoardSettings → User
 *
 * @param req - Incoming request.
 * @param params - Route params containing the target user id.
 * @returns 200 on success, or an error response.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);
  if (session.user.role !== "ADMIN") return fail("FORBIDDEN", 403);

  const { id } = await params;

  if (id === session.user.id) return fail("CANNOT_DELETE_SELF", 403);

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return fail("NOT_FOUND", 404);

  await prisma.$transaction([
    prisma.issue.deleteMany({ where: { project: { issueProvider: { userId: id } } } }),
    prisma.project.deleteMany({ where: { issueProvider: { userId: id } } }),
    prisma.issueProvider.deleteMany({ where: { userId: id } }),
    prisma.boardSettings.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);

  return ok(null);
}
