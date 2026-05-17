/**
 * DELETE /api/account/links/[provider] — unlinks an IdP from the user's account.
 * Returns 400 LAST_AUTH_METHOD when unlinking would leave the user with no
 * authentication method. Returns 204 on success.
 */

import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/api-response";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/db";
import { canUnlinkAccount } from "@/services/auth-provider/account-linking";

/**
 * Unlinks a provider account from the authenticated user.
 *
 * @param request - The incoming HTTP request.
 * @param context - Route context containing the `provider` param.
 * @returns 204 on success, 400 LAST_AUTH_METHOD, 401, or 404.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return fail("UNAUTHORIZED", 401);
  }

  const { provider } = await params;
  const userId = session.user.id;

  const canUnlink = await canUnlinkAccount(userId, provider);
  if (!canUnlink) {
    return fail("LAST_AUTH_METHOD", 400);
  }

  const deleted = await prisma.account.deleteMany({
    where: { userId, provider },
  });

  if (deleted.count === 0) {
    return fail("NOT_FOUND", 404);
  }

  return ok(null, 204);
}
