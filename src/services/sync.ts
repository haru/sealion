import pLimit from "p-limit";
import type { AxiosError } from "axios";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { createAdapter } from "@/services/issue-provider/factory";

const PROVIDER_CONCURRENCY = 3;
const PROJECT_CONCURRENCY = 5;

/**
 * Syncs issues for all enabled projects belonging to the given user.
 * External service is the source of truth — all returned issues are upserted.
 * @param userId - ID of the user whose providers and projects are synced.
 */
export async function syncProviders(userId: string): Promise<void> {
  const providers = await prisma.issueProvider.findMany({
    where: { userId },
    include: {
      projects: {
        select: { id: true, externalId: true, includeUnassigned: true },
      },
    },
  });

  const providerLimit = pLimit(PROVIDER_CONCURRENCY);
  const projectLimit = pLimit(PROJECT_CONCURRENCY);

  await Promise.all(
    providers.map((provider) =>
      providerLimit(async () => {
        const decryptedCredentials = JSON.parse(decrypt(provider.encryptedCredentials));
        const credentials = { ...decryptedCredentials, ...(provider.baseUrl ? { baseUrl: provider.baseUrl } : {}) };
        const adapter = createAdapter(provider.type, credentials);

        await Promise.all(
          provider.projects.map((project) =>
            projectLimit(async () => {
              try {
                const assignedIssues = await adapter.fetchAssignedIssues(project.externalId);

                let allIssues = assignedIssues;
                if (project.includeUnassigned) {
                  try {
                    const unassignedIssues = await adapter.fetchUnassignedIssues(project.externalId);
                    const assignedIds = new Set(assignedIssues.map((i) => i.externalId));
                    const filteredUnassigned = unassignedIssues.filter(
                      (i) => !assignedIds.has(i.externalId)
                    );
                    allIssues = [...assignedIssues, ...filteredUnassigned];
                  } catch (unassignedError) {
                    // Treat fetchUnassignedIssues failure as fatal to avoid deleting valid unassigned issues.
                    throw unassignedError;
                  }
                }

                const now = new Date();
                const returnedExternalIds = allIssues.map((i) => i.externalId);

                await prisma.$transaction(async (tx) => {
                  await Promise.all(
                    allIssues.map((issue) =>
                      tx.issue.upsert({
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
                          isUnassigned: issue.isUnassigned,
                          lastSyncedAt: now,
                          providerCreatedAt: issue.providerCreatedAt,
                          providerUpdatedAt: issue.providerUpdatedAt,
                          // Reset today fields when issue is closed (FR-010)
                          ...(issue.status === "CLOSED"
                            ? { todayFlag: false, todayOrder: null, todayAddedAt: null }
                            : {}),
                        },
                        create: {
                          projectId: project.id,
                          externalId: issue.externalId,
                          title: issue.title,
                          status: issue.status,
                          priority: issue.priority,
                          dueDate: issue.dueDate,
                          externalUrl: issue.externalUrl,
                          isUnassigned: issue.isUnassigned,
                          lastSyncedAt: now,
                          providerCreatedAt: issue.providerCreatedAt,
                          providerUpdatedAt: issue.providerUpdatedAt,
                        },
                      })
                    )
                  );

                  // Delete issues not returned (closed or unassigned externally)
                  await tx.issue.deleteMany({
                    where: {
                      projectId: project.id,
                      externalId: { notIn: returnedExternalIds },
                    },
                  });

                  await tx.project.update({
                    where: { id: project.id },
                    data: { lastSyncedAt: now, syncError: null },
                  });
                });
              } catch (err) {
                const isRateLimit = (err as AxiosError)?.response?.status === 429;

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
