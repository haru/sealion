interface SyncProject {
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
  if (projects.length === 0) return false;

  const hasSuccessfulProject = projects.some(
    (p) => p.syncError === null && p.lastSyncedAt !== null
  );
  if (!hasSuccessfulProject) return false;

  const timestamps = projects
    .filter((p) => p.lastSyncedAt !== null)
    .map((p) => new Date(p.lastSyncedAt!).getTime());
  if (timestamps.length === 0) return false;

  const elapsed = Date.now() - Math.max(...timestamps);
  return elapsed < throttleMs;
}

/**
 * Returns true when every project has been processed at or after `since`
 * (i.e. `lastSyncedAt >= since`), regardless of whether the sync succeeded or
 * produced an error. Once the server has processed a project its `lastSyncedAt`
 * is updated, so this is the reliable signal that syncing is done.
 * Also returns true when there are no projects (nothing to sync).
 *
 * @param providers - List of sync providers returned by GET /api/sync.
 * @param since - Timestamp representing the earliest time that should count as
 *   part of the current sync cycle; only projects whose `lastSyncedAt` is at or
 *   after this moment are considered processed.
 * @returns True if every project has been processed at or after `since`.
 */
export function allProjectsProcessed(providers: SyncProvider[], since: Date): boolean {
  const projects = providers.flatMap((p) => p.projects);
  if (projects.length === 0) return true;
  return projects.every(
    (proj) =>
      proj.lastSyncedAt !== null &&
      new Date(proj.lastSyncedAt) >= since
  );
}
