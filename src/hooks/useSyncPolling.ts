"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { allProjectsProcessed, shouldThrottleSync, SYNC_THROTTLE_MS } from "@/lib/sync-utils";

/** Provider with project sync status, as returned by GET /api/sync. */
export interface SyncProvider {
  /** Internal provider ID. */
  id: string;
  /** Display name of the provider. */
  displayName: string;
  /** Provider type (GITHUB, JIRA, REDMINE). */
  type: string;
  /** Projects belonging to this provider, with sync timestamps. */
  projects: SyncProject[];
}

/** Project sync status within a provider. */
export interface SyncProject {
  /** Internal project ID. */
  id: string;
  /** Display name of the project. */
  displayName: string;
  /** ISO 8601 timestamp of the last completed sync, or `null`. */
  lastSyncedAt: string | null;
  /** Sync error information string (JSON-encoded), or `null`. */
  syncError: string | null;
}

/** Return type of {@link useSyncPolling}. */
export interface UseSyncPollingResult {
  /** Whether a sync operation is currently in progress. */
  isSyncing: boolean;
  /** Current sync provider/project status data. */
  syncProviders: SyncProvider[];
  /** Triggers a new sync operation. */
  handleSyncNow: () => void;
  /** Updates sync providers from an external source (e.g. initial fetch). */
  setSyncProviders: (providers: SyncProvider[]) => void;
  /**
   * Starts a sync if providers have not been synced recently (throttle check).
   * Call once during initial data load.
   *
   * @param providers - The initial provider data to check throttle against.
   */
  maybeAutoSync: (providers: SyncProvider[]) => void;
}

/**
 * Manages sync polling lifecycle: starting a sync, polling for completion,
 * and auto-syncing on mount when not throttled.
 *
 * @param onSyncComplete - Called when all projects have finished syncing.
 * @param addErrorMessage - Called to display an error notification.
 * @param errorMessageText - Translated error message text for sync failures.
 * @returns Sync state and control functions.
 */
export function useSyncPolling(
  onSyncComplete: () => Promise<void>,
  addErrorMessage: (type: "error", msg: string) => void,
  errorMessageText: string,
): UseSyncPollingResult {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProviders, setSyncProviders] = useState<SyncProvider[]>([]);
  const syncStartedAtRef = useRef<Date | null>(null);

  const startSync = useCallback(async () => {
    syncStartedAtRef.current = new Date();
    setIsSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (!res.ok) {
        setIsSyncing(false);
        addErrorMessage("error", errorMessageText);
      }
    } catch {
      setIsSyncing(false);
      addErrorMessage("error", errorMessageText);
    }
  }, [addErrorMessage, errorMessageText]);

  // Poll for sync completion
  useEffect(() => {
    if (!isSyncing) return;

    let cancelled = false;
    let pollTimeout: ReturnType<typeof setTimeout>;

    /** Polls the sync status endpoint and refreshes data when all providers have synced. */
    async function poll() {
      if (cancelled) return;

      try {
        const syncRes = await fetch("/api/sync");
        if (!cancelled && syncRes.ok) {
          const json = await syncRes.json();
          const providers: SyncProvider[] = json.data;
          setSyncProviders(providers);

          const since = syncStartedAtRef.current;
          if (since && allProjectsProcessed(providers, since)) {
            if (!cancelled) await onSyncComplete();
            setIsSyncing(false);
            return;
          }
        }
      } catch {
        // Network error during poll — stop syncing and notify user
        if (!cancelled) {
          setIsSyncing(false);
          addErrorMessage("error", errorMessageText);
          return;
        }
      }

      if (!cancelled) {
        pollTimeout = setTimeout(poll, 5000);
      }
    }

    pollTimeout = setTimeout(poll, 5000);

    const safetyTimeout = setTimeout(() => {
      cancelled = true;
      setIsSyncing(false);
    }, 120000);

    return () => {
      cancelled = true;
      clearTimeout(pollTimeout);
      clearTimeout(safetyTimeout);
    };
  }, [isSyncing, onSyncComplete, addErrorMessage, errorMessageText]);

  const handleSyncNow = useCallback(() => {
    void startSync();
  }, [startSync]);

  const maybeAutoSync = useCallback(
    (providers: SyncProvider[]) => {
      if (!shouldThrottleSync(providers, SYNC_THROTTLE_MS)) {
        void startSync();
      }
    },
    [startSync],
  );

  return {
    isSyncing,
    syncProviders,
    handleSyncNow,
    setSyncProviders,
    maybeAutoSync,
  };
}
