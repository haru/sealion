import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";
import { deleteUserCascade } from "@/lib/deleteUserCascade";
import { UserRole } from "@prisma/client";

/**
 * DELETE /api/account/me — Deletes the authenticated user's own account.
 *
 * Authorization rules:
 * - Requires an active session (401 if missing).
 * - The sole system administrator cannot delete their account (403 LAST_ADMIN).
 *
 * On success, the user row and all cascading data are removed atomically:
 * Issue → Project → IssueProvider → BoardSettings → User.
 * The caller (client) is responsible for calling `signOut()` after receiving 200.
 *
 * @returns `200 { data: null, error: null }` on success,
 *          `401` if unauthenticated,
 *          `403 LAST_ADMIN` if the user is the sole administrator,
 *          `500` on unexpected server error.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return fail("UNAUTHORIZED", 401);
  }

  const userId = session.user.id;
  const userRole = session.user.role as UserRole | undefined;

  // Last-admin guard: count active ADMIN users before allowing deletion
  if (userRole === UserRole.ADMIN) {
    const adminCount = await prisma.user.count({ where: { role: UserRole.ADMIN } });
    if (adminCount <= 1) {
      return fail("LAST_ADMIN", 403);
    }
  }

  try {
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
