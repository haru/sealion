import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";
import { syncProviders } from "@/services/sync";

/**
 * POST /api/sync — Triggers a fire-and-forget sync of all providers for the authenticated user.
 * Errors are collected and processed for display via MessageQueue.
 */
export async function POST() {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  // Fire-and-forget sync — returns 202 immediately
  // Errors are processed asynchronously and stored for UI display
  syncProviders(session.user.id).then((syncErrors) => {
    if (syncErrors.length > 0) {
      console.log(`Sync completed with ${syncErrors.length} errors:`, syncErrors);

      // Errors would typically be displayed through a mechanism like:
      // 1. Store in a global state/context
      // 2. Emit via WebSocket/SSE
      // 3. Have frontend poll for sync status

      // For now, errors are logged and can be retrieved via GET /api/sync
      // The frontend SyncStatus component will display them from Project.syncError field
    }
  }).catch((error) => {
    console.error('Sync failed:', error);
  });

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
