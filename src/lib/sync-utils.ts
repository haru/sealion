interface SyncProject {
  lastSyncedAt: string | null;
  isEnabled: boolean;
}

interface SyncProvider {
  projects: SyncProject[];
}

/**
 * Returns true when every enabled project has been synced at or after `since`.
 * Also returns true when there are no enabled projects (nothing to sync).
 */
export function allEnabledProjectsSynced(providers: SyncProvider[], since: Date): boolean {
  const enabledProjects = providers.flatMap((p) => p.projects.filter((proj) => proj.isEnabled));
  if (enabledProjects.length === 0) return true;
  return enabledProjects.every(
    (proj) => proj.lastSyncedAt !== null && new Date(proj.lastSyncedAt) >= since
  );
}
