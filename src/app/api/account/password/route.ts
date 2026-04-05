import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/api-response";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/db";

/**
 * Changes the authenticated user's password.
 *
 * Validates that `currentPassword` matches the stored bcrypt hash, then replaces
 * `passwordHash` with a fresh hash of `newPassword`.
 *
 * Error codes returned in `{ error }`:
 * - `UNAUTHORIZED` — no valid session
 * - `INVALID_INPUT` — malformed request body
 * - `PASSWORD_CURRENT_REQUIRED` — `currentPassword` field is empty
 * - `PASSWORD_TOO_SHORT` — `newPassword` is fewer than 8 characters
 * - `PASSWORD_INCORRECT` — `currentPassword` does not match the stored hash
 * - `INTERNAL_ERROR` — unexpected server-side failure
 *
 * @param request - The incoming PATCH request containing `currentPassword` and `newPassword`.
 * @returns `200 { data: null, error: null }` on success,
 *          `400` on validation failure or wrong current password,
 *          `401` if unauthenticated,
 *          `500` on unexpected server error.
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

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).currentPassword !== "string" ||
    typeof (body as Record<string, unknown>).newPassword !== "string"
  ) {
    return fail("INVALID_INPUT", 400);
  }

  const { currentPassword, newPassword } = body as { currentPassword: string; newPassword: string };

  if (!currentPassword) {
    return fail("PASSWORD_CURRENT_REQUIRED", 400);
  }

  if (newPassword.length < 8) {
    return fail("PASSWORD_TOO_SHORT", 400);
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return fail("UNAUTHORIZED", 401);
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return fail("PASSWORD_INCORRECT", 400);
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, passwordChangedAt: new Date() },
    });

    return ok(null);
  } catch (err: unknown) {
    console.error("[account/password] PATCH failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return fail("INTERNAL_ERROR", 500);
  }
}
