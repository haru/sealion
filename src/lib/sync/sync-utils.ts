interface SyncProject {
  id: string;
  lastSyncedAt: string | null;
  syncError: string | null;
}

interface SyncProvider {
  projects: SyncProject[];
}

/** Throttle window in milliseconds (15 minutes). */
export const SYNC_THROTTLE_MS = 15 * 60 * 1000;

/**
 * Returns true when auto-sync should be skipped for the current page load.
 *
 * Throttle applies when ALL of the following hold:
 *   1. The latest `lastSyncedAt` across all projects is within `throttleMs` milliseconds of now
 *      (elapsed time is less than threshold).
 *   2. At least one project has `syncError === null` and `lastSyncedAt !== null`
 *      (i.e. at least one successful sync exists).
 *
 * Returns false (sync runs) when:
 *   - There are no projects.
 *   - No project has a non-null `lastSyncedAt`.
 *   - All projects have a non-null `syncError` (all failed).
 *   - The most recent sync was at or beyond `throttleMs` milliseconds ago.
 *
 * @param providers - List of sync providers returned by GET /api/sync.
 * @param throttleMs - Throttle window in milliseconds. Use SYNC_THROTTLE_MS for the default.
 * @returns True if sync should be skipped; false if sync should run.
 */
export function shouldThrottleSync(providers: SyncProvider[], throttleMs: number): boolean {
  const projects = providers.flatMap((p) => p.projects);
  if (projects.length === 0) { return false; }

  const hasSuccessfulProject = projects.some(
    (p) => p.syncError === null && p.lastSyncedAt !== null
  );
  if (!hasSuccessfulProject) { return false; }

  const timestamps = projects
    .filter((p) => p.lastSyncedAt !== null)
    .map((p) => new Date(p.lastSyncedAt!).getTime());
  if (timestamps.length === 0) { return false; }

  const elapsed = Date.now() - Math.max(...timestamps);
  return elapsed < throttleMs;
}

/**
 * Returns true when every project's `lastSyncedAt` differs from its
 * pre-sync baseline value, indicating the server has processed each
 * project. Uses baseline comparison (value-change detection) instead
 * of clock-based comparison to be immune to client–server clock skew.
 *
 * Also returns true when there are no projects (nothing to sync).
 *
 * @param providers - List of sync providers returned by GET /api/sync.
 * @param baseline - Snapshot of project lastSyncedAt values captured
 *   immediately before the sync was triggered. Keys are project IDs,
 *   values are the corresponding `lastSyncedAt` at that moment.
 * @returns True if every project has a different `lastSyncedAt` from
 *   its baseline value.
 */
export function allProjectsProcessed(
  providers: SyncProvider[],
  baseline: ReadonlyMap<string, string | null>,
): boolean {
  const projects = providers.flatMap((p) => p.projects);
  if (projects.length === 0) { return true; }
  return projects.every(
    (proj) =>
      proj.lastSyncedAt !== null &&
      proj.lastSyncedAt !== baseline.get(proj.id),
  );
}
