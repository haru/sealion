import pLimit from "p-limit";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { createAdapter } from "@/services/issue-provider/factory";

const PROVIDER_CONCURRENCY = 3;
const PROJECT_CONCURRENCY = 5;

/**
 * Syncs issues for all enabled projects belonging to the given user.
 * External service is the source of truth — all returned issues are upserted.
 */
export async function syncProviders(userId: string): Promise<void> {
  const providers = await prisma.issueProvider.findMany({
    where: { userId },
    include: {
      projects: {
        where: { isEnabled: true },
        select: { id: true, externalId: true },
      },
    },
  });

  const providerLimit = pLimit(PROVIDER_CONCURRENCY);
  const projectLimit = pLimit(PROJECT_CONCURRENCY);

  await Promise.all(
    providers.map((provider) =>
      providerLimit(async () => {
        const credentials = JSON.parse(decrypt(provider.encryptedCredentials));
        const adapter = createAdapter(provider.type, credentials);

        await Promise.all(
          provider.projects.map((project) =>
            projectLimit(async () => {
              try {
                const issues = await adapter.fetchAssignedIssues(project.externalId);
                const now = new Date();

                await prisma.$transaction(
                  issues.map((issue) =>
                    prisma.issue.upsert({
                      where: {
                        projectId_externalId: {
                          projectId: project.id,
                          externalId: issue.externalId,
                        },
                      },
                      update: {
                        title: issue.title,
                        status: issue.status,
                        priority: issue.priority,
                        dueDate: issue.dueDate,
                        externalUrl: issue.externalUrl,
                        lastSyncedAt: now,
                      },
                      create: {
                        projectId: project.id,
                        externalId: issue.externalId,
                        title: issue.title,
                        status: issue.status,
                        priority: issue.priority,
                        dueDate: issue.dueDate,
                        externalUrl: issue.externalUrl,
                        lastSyncedAt: now,
                      },
                    })
                  )
                );

                await prisma.project.update({
                  where: { id: project.id },
                  data: { lastSyncedAt: now, syncError: null },
                });
              } catch (err) {
                const isRateLimit =
                  err instanceof Error &&
                  (err.message.includes("rate limit") || err.message.includes("429"));

                console.error(`[sync] project ${project.externalId} failed:`, err);

                await prisma.project.update({
                  where: { id: project.id },
                  data: {
                    syncError: isRateLimit ? "RATE_LIMITED" : "SYNC_FAILED",
                    lastSyncedAt: new Date(),
                  },
                });
              }
            })
          )
        );
      })
    )
  );
}
