interface SyncProject {
  lastSyncedAt: string | null;
  syncError: string | null;
}

interface SyncProvider {
  projects: SyncProject[];
}

/**
 * Returns true when every project has been successfully synced at or after `since`
 * (i.e. lastSyncedAt >= since AND syncError is null).
 * Also returns true when there are no projects (nothing to sync).
 */
export function allEnabledProjectsSynced(providers: SyncProvider[], since: Date): boolean {
  const projects = providers.flatMap((p) => p.projects);
  if (projects.length === 0) return true;
  return projects.every(
    (proj) =>
      proj.lastSyncedAt !== null &&
      new Date(proj.lastSyncedAt) >= since &&
      proj.syncError === null
  );
}
