/**
 * GET /api/account/links — returns the calling user's linked IdP Accounts.
 * Requires authentication. No secret fields are returned.
 */

import { fail, ok } from "@/lib/api/api-response";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/db";

/**
 * Returns the authenticated user's Account rows joined with the matching
 * AuthProvider displayName and type.
 *
 * @returns JSON response with the linked account list.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return fail("UNAUTHORIZED", 401);
  }

  const accounts = await prisma.account.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      provider: true,
      type: true,
    },
    orderBy: { id: "asc" },
  });

  const providerMap = await prisma.authProvider.findMany({
    where: { providerId: { in: accounts.map((a) => a.provider) } },
    select: { providerId: true, type: true, displayName: true },
  });

  const byProviderId = new Map(providerMap.map((p) => [p.providerId, p]));

  const data = accounts.map((a) => {
    const meta = byProviderId.get(a.provider);
    return {
      id: a.id,
      provider: a.provider,
      type: meta?.type ?? "OIDC_GENERIC",
      displayName: meta?.displayName ?? a.provider,
    };
  });

  return ok(data);
}
