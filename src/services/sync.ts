import pLimit from "p-limit";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { createAdapter, ProviderCredentials } from "@/services/issue-provider/factory";
import { SyncErrorInfo } from "@/lib/types";
import { createSyncErrorInfo } from "@/lib/error-utils";

const PROVIDER_CONCURRENCY = 3;
const PROJECT_CONCURRENCY = 5;

/**
 * Syncs issues for all enabled projects belonging to given user.
 * External service is source of truth — all returned issues are upserted;
 * issues no longer returned by adapter are deleted from local DB.
 * DB invariant: only issues considered open by providers are stored locally (adapters return only open issues).
 * @param userId - ID of user whose providers and projects are synced.
 * @returns Array of detailed sync errors that occurred during sync.
 */
export async function syncProviders(userId: string): Promise<SyncErrorInfo[]> {
  const providers = await prisma.issueProvider.findMany({
    where: { userId },
    include: {
      projects: {
        select: { id: true, externalId: true, includeUnassigned: true, displayName: true },
      },
    },
  });

  const providerLimit = pLimit(PROVIDER_CONCURRENCY);
  const projectLimit = pLimit(PROJECT_CONCURRENCY);

  const providerErrorLists = await Promise.all(
    providers.map((provider) =>
      providerLimit(async (): Promise<SyncErrorInfo[]> => {
        const providerName = provider.displayName || provider.type;

        let decryptedCredentials: Record<string, unknown>;
        try {
          decryptedCredentials = JSON.parse(decrypt(provider.encryptedCredentials));
        } catch (decryptErr) {
          const technicalMessage = decryptErr instanceof Error ? decryptErr.message : String(decryptErr);
          console.error(`[sync] ${providerName}: credential decryption failed — ${technicalMessage}`);

          const credentialErrors = provider.projects.map((project) => {
            const projectName = project.displayName || project.externalId;
            return createSyncErrorInfo(providerName, projectName, decryptErr);
          });
          return credentialErrors;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const credentials: any = { ...decryptedCredentials, ...(provider.baseUrl ? { baseUrl: provider.baseUrl } : {}) };
        const adapter = createAdapter(provider.type, credentials as ProviderCredentials);

        const projectErrorLists = await Promise.all(
          provider.projects.map((project) =>
            projectLimit(async (): Promise<SyncErrorInfo[]> => {
              try {
                const assignedIssues = await adapter.fetchAssignedIssues(project.externalId);

                let allIssues = assignedIssues;
                if (project.includeUnassigned) {
                  const unassignedIssues = await adapter.fetchUnassignedIssues(project.externalId);
                  const assignedIds = new Set(assignedIssues.map((i) => i.externalId));
                  const filteredUnassigned = unassignedIssues.filter(
                    (i) => !assignedIds.has(i.externalId)
                  );
                  allIssues = [...assignedIssues, ...filteredUnassigned];
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
                          dueDate: issue.dueDate,
                          externalUrl: issue.externalUrl,
                          isUnassigned: issue.isUnassigned,
                          lastSyncedAt: now,
                          providerCreatedAt: issue.providerCreatedAt,
                          providerUpdatedAt: issue.providerUpdatedAt,
                        },
                        create: {
                          projectId: project.id,
                          externalId: issue.externalId,
                          title: issue.title,
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

                return [];
              } catch (err) {
                const projectName = project.displayName || project.externalId;
                // Log the technical detail server-side before stripping it from the persisted payload.
                const technicalMessage = err instanceof Error ? err.message : String(err);
                console.error(
                  `[sync] ${providerName}/${projectName} failed: ${technicalMessage}`
                );

                const errorInfo = createSyncErrorInfo(providerName, projectName, err);

                await prisma.project.update({
                  where: { id: project.id },
                  data: {
                    syncError: JSON.stringify(errorInfo),
                    lastSyncedAt: new Date(),
                  },
                });

                return [errorInfo];
              }
            })
          )
        );

        return projectErrorLists.flat();
      })
    )
  );

  // Flatten and sort by providerName then projectName for stable, deterministic ordering.
  const allErrors = providerErrorLists.flat();
  allErrors.sort((a, b) => {
    const providerCmp = a.providerName.localeCompare(b.providerName);
    return providerCmp !== 0 ? providerCmp : a.projectName.localeCompare(b.projectName);
  });
  return allErrors;
}
