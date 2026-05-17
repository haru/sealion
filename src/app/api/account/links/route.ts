import { fail, ok } from "@/lib/api/api-response";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return fail("UNAUTHORIZED", 401);
  }

  try {
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
  } catch (error: unknown) {
    console.error("[api/account/links GET]", { userId: session.user.id, error });
    return fail("INTERNAL_ERROR", 500);
  }
}
