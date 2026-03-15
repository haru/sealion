import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { createAdapter } from "@/services/issue-provider/factory";

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

  await Promise.all(
    providers.map(async (provider) => {
      const credentials = JSON.parse(decrypt(provider.encryptedCredentials));
      const adapter = createAdapter(provider.type, credentials);

      await Promise.all(
        provider.projects.map(async (project) => {
          try {
            const issues = await adapter.fetchAssignedIssues(project.externalId);

            await Promise.all(
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
                  },
                  create: {
                    projectId: project.id,
                    externalId: issue.externalId,
                    title: issue.title,
                    status: issue.status,
                    priority: issue.priority,
                    dueDate: issue.dueDate,
                    externalUrl: issue.externalUrl,
                  },
                })
              )
            );

            await prisma.project.update({
              where: { id: project.id },
              data: { lastSyncedAt: new Date() },
            });
          } catch (err) {
            const isRateLimit =
              err instanceof Error &&
              (err.message.includes("rate limit") || err.message.includes("429"));

            await prisma.project.update({
              where: { id: project.id },
              data: {
                syncError: isRateLimit ? "RATE_LIMITED" : "SYNC_FAILED",
              } as Record<string, unknown>,
            });
          }
        })
      );
    })
  );
}
