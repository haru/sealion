import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";

const MAX_USERNAME_LENGTH = 50;

/**
 * Updates the authenticated user's profile (username).
 *
 * Accepts `{ username: string | null }`. The value is trimmed; if the trimmed
 * result is empty the field is treated as `null` (cleared).
 *
 * Error codes returned in `{ error }`:
 * - `UNAUTHORIZED` — no valid session
 * - `INVALID_INPUT` — malformed request body or missing `username` key
 * - `USERNAME_TOO_LONG` — trimmed username exceeds 50 characters
 * - `USERNAME_REQUIRED` — trimmed username is empty but not explicitly null
 * - `INTERNAL_ERROR` — unexpected server-side failure
 *
 * @param request - The incoming PATCH request containing `{ username }`.
 * @returns `200 { data: null, error: null }` on success,
 *          `400` on validation failure,
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
    !("username" in body)
  ) {
    return fail("INVALID_INPUT", 400);
  }

  const rawUsername = (body as Record<string, unknown>).username;

  if (rawUsername === null) {
    try {
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

  if (trimmed.length === 0) {
    return fail("USERNAME_REQUIRED", 400);
  }

  if (trimmed.length > MAX_USERNAME_LENGTH) {
    return fail("USERNAME_TOO_LONG", 400);
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { username: trimmed },
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
