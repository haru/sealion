import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";
import { syncProviders } from "@/services/sync";

export async function POST() {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  // Fire-and-forget sync — returns 202 immediately
  syncProviders(session.user.id).catch(console.error);

  return ok({ syncing: true }, 202);
}

export async function GET() {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const providers = await prisma.issueProvider.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      displayName: true,
      type: true,
      projects: {
        select: {
          id: true,
          displayName: true,
          lastSyncedAt: true,
          isEnabled: true,
          syncError: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return ok(providers);
}
