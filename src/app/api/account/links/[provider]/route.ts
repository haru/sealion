import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/api-response";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/db";
import { canUnlinkAccount } from "@/services/auth-provider/account-linking";

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

  try {
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
  } catch (error: unknown) {
    console.error("[api/account/links DELETE]", { userId, provider, error });
    return fail("INTERNAL_ERROR", 500);
  }
}
