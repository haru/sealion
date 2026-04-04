import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";
import { UserRole, UserStatus } from "@prisma/client";

const MAX_USERNAME_LENGTH = 50;

/**
 * Returns the authenticated user's profile.
 *
 * Response fields:
 * - `username` — the user's display name (may be null)
 * - `email` — the user's email address
 * - `isLastAdmin` — true when the user is an ADMIN and the only active admin in the system;
 *   always false for regular users. Used to conditionally hide the "Delete Account" button.
 *
 * @returns `200 { data: { username, email, isLastAdmin }, error: null }` on success,
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
      select: { username: true, email: true, role: true },
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

    return ok({ username: user.username, email: user.email, isLastAdmin });
  } catch (err: unknown) {
    console.error("[account/profile] GET failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return fail("INTERNAL_ERROR", 500);
  }
}

/**
 * Updates the authenticated user's profile (username).
 *
 * Accepts `{ username: string | null }`. The value is trimmed; if the trimmed
 * result is empty the field is treated as `null` (cleared).
 *
 * Error codes returned in `{ error }`:
 * - `UNAUTHORIZED` — no valid session or user record not found
 * - `INVALID_INPUT` — malformed request body or missing `username` key
 * - `USERNAME_TOO_LONG` — trimmed username exceeds 50 characters
 * - `INTERNAL_ERROR` — unexpected server-side failure
 *
 * @param request - The incoming PATCH request containing `{ username }`.
 * @returns `200 { data: null, error: null }` on success,
 *          `400` on validation failure,
 *          `401` if unauthenticated or user not found,
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
    !("username" in body)
  ) {
    return fail("INVALID_INPUT", 400);
  }

  const rawUsername = (body as Record<string, unknown>).username;

  if (rawUsername === null) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return fail("UNAUTHORIZED", 401);
      }

      await prisma.user.update({
        where: { id: userId },
        data: { username: null },
      });
      return ok(null);
    } catch (err: unknown) {
      console.error("[account/profile] PATCH failed", {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      return fail("INTERNAL_ERROR", 500);
    }
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

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return fail("UNAUTHORIZED", 401);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { username },
    });
    return ok(null);
  } catch (err: unknown) {
    console.error("[account/profile] PATCH failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return fail("INTERNAL_ERROR", 500);
  }
}
