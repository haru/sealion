import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/api-response";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/db";
import { canUnlinkAccount } from "@/services/auth-provider/account-linking";

/**
 * Unlinks an OAuth provider account from the authenticated user.
 *
 * @param request - The incoming HTTP request.
 * @param params - Route parameters containing the provider name.
 * @returns `204` on success, `400` if it is the last auth method,
 *          `401` if unauthenticated, `404` if the link does not exist,
 *          `500` on unexpected error.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return fail("UNAUTHORIZED", 401);
  }

  const { provider } = await params;
  const userId = session.user.id;

  try {
    const account = await prisma.account.findFirst({
      where: { userId, provider },
    });

    if (!account) {
      return fail("NOT_FOUND", 404);
    }

    const canUnlink = await canUnlinkAccount(userId, provider);
    if (!canUnlink) {
      return fail("LAST_AUTH_METHOD", 400);
    }

    await prisma.account.deleteMany({
      where: { userId, provider },
    });

    return ok(null, 204);
  } catch (error: unknown) {
    console.error("[api/account/links DELETE]", { userId, provider, error });
    return fail("INTERNAL_ERROR", 500);
  }
}
