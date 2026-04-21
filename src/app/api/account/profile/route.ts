import { UserRole, UserStatus } from "@prisma/client";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/api-response";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/db";

const MAX_USERNAME_LENGTH = 50;

/**
 * Returns the authenticated user's profile.
 *
 * Response fields:
 * - `username` — the user's display name (may be null)
 * - `email` — the user's email address
 * - `isLastAdmin` — true when the user is an ADMIN and the only active admin in the system;
 *   always false for regular users. Used to conditionally hide the "Delete Account" button.
 * - `useGravatar` — whether the user has enabled Gravatar as their avatar
 *
 * @returns `200 { data: { username, email, isLastAdmin, useGravatar }, error: null }` on success,
 *          `401` if unauthenticated or user not found,
 *          `500` on unexpected server error.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return fail("UNAUTHORIZED", 401);
  }

  const userId = session.user.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, email: true, role: true, useGravatar: true },
    });
    if (!user) {
      return fail("UNAUTHORIZED", 401);
    }

    let isLastAdmin = false;
    if (user.role === UserRole.ADMIN) {
      // Count only ACTIVE admins — suspended or pending admins must not affect this decision.
      const adminCount = await prisma.user.count({
        where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
      });
      isLastAdmin = adminCount <= 1;
    }

    return ok({ username: user.username, email: user.email, isLastAdmin, useGravatar: user.useGravatar });
  } catch (err: unknown) {
    console.error("[account/profile] GET failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return fail("INTERNAL_ERROR", 500);
  }
}

/**
 * Updates the authenticated user's profile.
 *
 * Accepts `{ username: string | null }` or `{ useGravatar: boolean }`.
 * For username: the value is trimmed; if the trimmed result is empty the field is treated as `null` (cleared).
 * For useGravatar: must be a boolean; non-boolean values are rejected.
 *
 * Error codes returned in `{ error }`:
 * - `UNAUTHORIZED` — no valid session or user record not found
 * - `INVALID_INPUT` — malformed request body, missing required key, or `useGravatar` is not a boolean
 * - `USERNAME_TOO_LONG` — trimmed username exceeds 50 characters
 * - `INTERNAL_ERROR` — unexpected server-side failure
 *
 * @param request - The incoming PATCH request.
 * @returns `200 { data: null, error: null }` on success,
 *          `400` on validation failure,
 *          `401` if unauthenticated or user not found,
 *          `500` on unexpected server error.
 */
/**
 * Updates the `useGravatar` field for the given user.
 * @param userId - The ID of the user to update.
 * @param value - The new Gravatar preference.
 */
async function patchUseGravatar(userId: string, value: boolean) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return fail("UNAUTHORIZED", 401);
  }
  await prisma.user.update({ where: { id: userId }, data: { useGravatar: value } });
  return ok(null);
}

/**
 * Updates the `username` field for the given user.
 * @param userId - The ID of the user to update.
 * @param rawUsername - The new username value (string, null, or unknown type).
 */
async function patchUsername(userId: string, rawUsername: unknown) {
  if (rawUsername === null) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return fail("UNAUTHORIZED", 401);
    }
    await prisma.user.update({ where: { id: userId }, data: { username: null } });
    return ok(null);
  }

  if (typeof rawUsername !== "string") {
    return fail("INVALID_INPUT", 400);
  }

  const trimmed = rawUsername.trim();
  // Normalize whitespace-only strings to null (clear the username)
  const username = trimmed.length === 0 ? null : trimmed;

  if (username !== null && username.length > MAX_USERNAME_LENGTH) {
    return fail("USERNAME_TOO_LONG", 400);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return fail("UNAUTHORIZED", 401);
  }
  await prisma.user.update({ where: { id: userId }, data: { username } });
  return ok(null);
}

/**
 * Updates the authenticated user's profile (username or useGravatar).
 *
 * Accepts `{ username: string | null }` or `{ useGravatar: boolean }`.
 *
 * @param request - The incoming PATCH request.
 * @returns `200 { data: null, error: null }` on success, `400`/`401`/`500` on failure.
 */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return fail("UNAUTHORIZED", 401);
  }

  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("INVALID_INPUT", 400);
  }

  if (typeof body !== "object" || body === null) {
    return fail("INVALID_INPUT", 400);
  }

  const bodyObj = body as Record<string, unknown>;

  try {
    if ("useGravatar" in bodyObj) {
      if (typeof bodyObj.useGravatar !== "boolean") {
        return fail("INVALID_INPUT", 400);
      }
      return await patchUseGravatar(userId, bodyObj.useGravatar);
    }

    if (!("username" in bodyObj)) {
      return fail("INVALID_INPUT", 400);
    }
    return await patchUsername(userId, bodyObj.username);
  } catch (err: unknown) {
    console.error("[account/profile] PATCH failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return fail("INTERNAL_ERROR", 500);
  }
}
