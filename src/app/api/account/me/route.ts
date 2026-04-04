import { UserRole, UserStatus } from "@prisma/client";

import { ok, fail } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteUserCascade } from "@/lib/deleteUserCascade";

/**
 * DELETE /api/account/me — Deletes the authenticated user's own account.
 *
 * Authorization rules:
 * - Requires an active session (401 if missing).
 * - The user must be ACTIVE in the database (401 if suspended/pending).
 * - The sole active system administrator cannot delete their account (403 LAST_ADMIN).
 *   Only ACTIVE admins are counted; suspended or pending admins are excluded.
 *
 * On success, the user row and all cascading data are removed atomically:
 * Issue → Project → IssueProvider → BoardSettings → User.
 * The caller (client) is responsible for calling `signOut()` after receiving 200.
 *
 * @returns `200 { data: null, error: null }` on success,
 *          `401` if unauthenticated or account is not active,
 *          `403 LAST_ADMIN` if the user is the sole active administrator,
 *          `500` on unexpected server error.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return fail("UNAUTHORIZED", 401);
  }

  const userId = session.user.id;

  try {
    // Fetch authoritative role and status from DB — do not trust stale session data.
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });

    if (!currentUser || currentUser.status !== UserStatus.ACTIVE) {
      return fail("UNAUTHORIZED", 401);
    }

    // Last-admin guard: count only ACTIVE admins so suspended/pending admins are excluded.
    if (currentUser.role === UserRole.ADMIN) {
      const adminCount = await prisma.user.count({
        where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
      });
      if (adminCount <= 1) {
        return fail("LAST_ADMIN", 403);
      }
    }

    await deleteUserCascade(prisma, userId);
    return ok(null);
  } catch (err: unknown) {
    console.error("[account/me] DELETE failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return fail("INTERNAL_ERROR", 500);
  }
}
