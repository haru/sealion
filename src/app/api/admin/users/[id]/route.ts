import { UserRole, UserStatus } from "@prisma/client";
import { hash } from "bcryptjs";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/api-response";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/db";
import { deleteUserCascade } from "@/lib/db/deleteUserCascade";

/** Maximum password length enforced by bcrypt. */
const MAX_PASSWORD_LENGTH = 72;

/** Valid user status values. */
const VALID_STATUSES = new Set(Object.values(UserStatus));

type Params = { params: Promise<{ id: string }> };

/** Minimum password length. */
const MIN_PASSWORD_LENGTH = 8;

/** Fields accepted by the PATCH body. */
type PatchBody = {
  status?: string;
  role?: string;
  email?: string;
  username?: string;
  password?: string;
  changePassword?: boolean;
};

/**
 * Build the Prisma update data object from validated PATCH body fields.
 *
 * @param body - The parsed patch request body.
 * @returns Promise resolving to the update data record.
 */
async function buildUpdateData(body: PatchBody): Promise<Record<string, unknown>> {
  const { status, role, email, username, password, changePassword } = body;
  const data: Record<string, unknown> = {};
  if (status && VALID_STATUSES.has(status as UserStatus)) { data.status = status; }
  if (role && Object.values(UserRole).includes(role as UserRole)) { data.role = role; }
  if (typeof email === "string" && email.trim()) { data.email = email.trim().toLowerCase(); }
  if (typeof username === "string") { data.username = username.trim(); }
  if (changePassword === true && typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH) {
    data.passwordHash = await hash(password, 12);
  }
  return data;
}

/**
 * Validate password-related fields when `changePassword` is requested.
 *
 * @param changePassword - The boolean flag from the request body.
 * @param password - The password value from the request body.
 * @returns An error response if validation fails, or `null` if validation passes.
 */
function validatePasswordChange(changePassword: unknown, password: unknown): ReturnType<typeof fail> | null {
  if (changePassword !== true) { return null; }
  if (typeof password !== "string" || password.length === 0) {
    return fail("PASSWORD_REQUIRED", 400);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return fail("PASSWORD_TOO_SHORT", 400);
  }
  return null;
}

/**
 * Validate the status and password-length fields from the PATCH body.
 *
 * @param body - The parsed patch request body.
 * @returns An error response if validation fails, or `null` if validation passes.
 */
function validatePatchFields(body: PatchBody): ReturnType<typeof fail> | null {
  const { status, password } = body;

  if (status !== undefined && !VALID_STATUSES.has(status as UserStatus)) {
    return fail("INVALID_INPUT", 400);
  }

  if (typeof password === "string" && password.length > MAX_PASSWORD_LENGTH) {
    return fail("PASSWORD_TOO_LONG", 400);
  }

  return null;
}

/**
 * PATCH /api/admin/users/[id] — Update a user's fields (admin only).
 *
 * Self-protection rules:
 * - Admin cannot change their own `role` to a different value (403 CANNOT_CHANGE_OWN_ROLE).
 * - Admin cannot change their own `status` (403 CANNOT_CHANGE_OWN_STATUS).
 * - All other self-edits (email, username, password, or setting role to same value) are permitted.
 *
 * @param req - Incoming request with optional body fields: status, role, email, username, password, changePassword.
 * @param params - Route params containing the target user id.
 * @returns Updated user data on success, or an error response.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) { return fail("UNAUTHORIZED", 401); }
  if (session.user.role !== "ADMIN") { return fail("FORBIDDEN", 403); }

  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) { return fail("INVALID_BODY", 400); }

  const patchBody = body as PatchBody;
  const { status, role, changePassword, password } = patchBody;

  const passwordError = validatePasswordChange(changePassword, password);
  if (passwordError) { return passwordError; }

  if (id === session.user.id && status !== undefined) {
    return fail("CANNOT_CHANGE_OWN_STATUS", 403);
  }

  const fieldError = validatePatchFields(patchBody);
  if (fieldError) { return fieldError; }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) { return fail("NOT_FOUND", 404); }

  if (id === session.user.id && role !== undefined && role !== target.role) {
    return fail("CANNOT_CHANGE_OWN_ROLE", 403);
  }

  const updateData = await buildUpdateData(patchBody);

  try {
    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, email: true, username: true, role: true, status: true },
    });

    return ok(updated);
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
      return fail("EMAIL_ALREADY_EXISTS", 409);
    }
    return fail("INTERNAL_ERROR", 500);
  }
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
  if (!session) { return fail("UNAUTHORIZED", 401); }
  if (session.user.role !== "ADMIN") { return fail("FORBIDDEN", 403); }

  const { id } = await params;

  if (id === session.user.id) { return fail("CANNOT_DELETE_SELF", 403); }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) { return fail("NOT_FOUND", 404); }

  await deleteUserCascade(prisma, id);

  return ok(null);
}
