import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";
import { syncProviders } from "@/services/sync";

/**
 * POST /api/sync — Triggers a fire-and-forget sync of all providers for the authenticated user.
 * Sync errors are stored per-project in the DB and surfaced to the client via GET /api/sync polling.
 */
export async function POST() {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  // Fire-and-forget sync — returns 202 immediately
  syncProviders(session.user.id).catch(console.error);

  return ok({ syncing: true }, 202);
}

/**
 * GET /api/sync — Returns all providers with their project sync status.
 */
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
          syncError: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return ok(providers);
}
