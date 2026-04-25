import { UserRole, UserStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/api-response";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/db";

const MAX_USERNAME_LENGTH = 50;

const patchGravatarSchema = z.object({ useGravatar: z.boolean() }).strict();
const patchUsernameSchema = z.object({ username: z.string().nullable() }).strict();
const patchBodySchema = z.union([patchGravatarSchema, patchUsernameSchema]);

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
 * @param rawUsername - The new username value (string or null).
 */
async function patchUsername(userId: string, rawUsername: string | null) {
  const trimmed = rawUsername === null ? null : rawUsername.trim();
  const username = trimmed !== null && trimmed.length === 0 ? null : trimmed;

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
 * Updates the authenticated user's profile.
 *
 * Accepts exactly one of `{ username: string | null }` or `{ useGravatar: boolean }`.
 * Requests containing both keys, unknown keys, or missing required keys are rejected.
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

  const parseResult = patchBodySchema.safeParse(body);
  if (!parseResult.success) {
    return fail("INVALID_INPUT", 400);
  }

  const parsed = parseResult.data;

  try {
    if ("useGravatar" in parsed) {
      return await patchUseGravatar(userId, parsed.useGravatar);
    }
    return await patchUsername(userId, parsed.username);
  } catch (err: unknown) {
    console.error("[account/profile] PATCH failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return fail("INTERNAL_ERROR", 500);
  }
}
