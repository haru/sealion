/**
 * Admin API for a single user: edit (PATCH) and delete (DELETE).
 * Edits that end a user's sessions are stamped here (spec 045).
 */

import { type Prisma, type User, UserRole, UserStatus } from "@prisma/client";
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

/** The current values of the user being edited, used to detect session-revoking changes. */
type TargetState = Readonly<Pick<User, "role" | "status">>;

/** The validated role/status values a PATCH will write. */
type RoleStatusChanges = { readonly role?: UserRole; readonly status?: UserStatus };

/**
 * Decides whether a PATCH ends the target's existing sessions (spec 045, FR-004/FR-005).
 *
 * Demotion (`ADMIN → USER`) and leaving `ACTIVE` revoke. Promotion, reactivation,
 * unchanged values, and email/username-only edits do not.
 *
 * @param changes - The validated role and status the PATCH will write.
 * @param target - The target user's role and status before the update.
 * @returns `true` when `sessionsRevokedAt` must be set.
 */
function revokesSessions(changes: RoleStatusChanges, target: TargetState): boolean {
  const demoted = target.role === UserRole.ADMIN && changes.role === UserRole.USER;
  const deactivated =
    target.status === UserStatus.ACTIVE && changes.status !== undefined && changes.status !== UserStatus.ACTIVE;
  return demoted || deactivated;
}

/**
 * Build the Prisma update data from validated PATCH body fields.
 *
 * Also stamps `sessionsRevokedAt` (see {@link revokesSessions}) and `passwordChangedAt`
 * (when an admin sets a password) so the target's older sessions stop working. The return
 * type is checked by the compiler, so a misspelt revocation column cannot compile.
 *
 * @param body - The parsed patch request body.
 * @param target - The target user's role and status before the update.
 * @returns Promise resolving to the update data.
 */
async function buildUpdateData(body: PatchBody, target: TargetState): Promise<Prisma.UserUpdateInput> {
  const { status, role, email, username, password, changePassword } = body;
  const now = new Date();
  const validStatus = status && VALID_STATUSES.has(status as UserStatus) ? (status as UserStatus) : undefined;
  const validRole = role && Object.values(UserRole).includes(role as UserRole) ? (role as UserRole) : undefined;
  const passwordHash =
    changePassword === true && typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH
      ? await hash(password, 12)
      : undefined;
  const normalizedEmail = typeof email === "string" && email.trim() ? email.trim().toLowerCase() : undefined;

  return {
    ...(validStatus ? { status: validStatus } : {}),
    ...(validRole ? { role: validRole } : {}),
    ...(normalizedEmail ? { email: normalizedEmail } : {}),
    ...(typeof username === "string" ? { username: username.trim() } : {}),
    ...(passwordHash ? { passwordHash, passwordChangedAt: now } : {}),
    ...(revokesSessions({ role: validRole, status: validStatus }, target) ? { sessionsRevokedAt: now } : {}),
  };
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
  if (password.length > MAX_PASSWORD_LENGTH) {
    return fail("PASSWORD_TOO_LONG", 400);
  }
  return null;
}

/**
 * Validate the status field and password-length constraints for explicit password changes.
 *
 * @param body - The parsed patch request body.
 * @returns An error response if validation fails, or `null` if validation passes.
 */
function validatePatchFields(body: PatchBody): ReturnType<typeof fail> | null {
  const { status } = body;

  if (status !== undefined && !VALID_STATUSES.has(status as UserStatus)) {
    return fail("INVALID_INPUT", 400);
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
 * Session side effects (spec 045, FR-004/FR-005/FR-007): demoting an ADMIN, moving a user out of
 * ACTIVE, or setting a password ends the target's existing sessions (`sessionsRevokedAt` /
 * `passwordChangedAt`). Promotion, reactivation, and email/username-only edits do not.
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

  const updateData = await buildUpdateData(patchBody, target);

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
    console.error("[admin/users PATCH] update failed", { id, fields: Object.keys(updateData), error: err });
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
