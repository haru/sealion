"use client";

import SyncIcon from "@mui/icons-material/Sync";
import { Button } from "@mui/material";
import { useTranslations } from "next-intl";
import React, { useEffect, useMemo, useRef } from "react";

import { useMessageQueue } from "@/hooks/useMessageQueue";
import { type SyncProvider } from "@/hooks/useSyncPolling";
import { formatSyncErrorMessage, parseSyncErrorInfo } from "@/lib/sync/error-utils";
import { type SyncErrorInfo, SyncErrorCause } from "@/lib/types";

interface SyncStatusProps {
  providers: SyncProvider[];
  isSyncing: boolean;
  /** Callback invoked when the user clicks the "Sync Now" button. */
  onSyncNow: () => void;
}

/** Displays the sync status chip and a "Sync Now" button. Errors are shown via the shared message queue. */
export default function SyncStatus({ providers, isSyncing, onSyncNow }: SyncStatusProps) {
  const t = useTranslations("todo");
  const tSync = useTranslations("sync");
  const { addMessage } = useMessageQueue();

  const allProjects = useMemo(() => providers.flatMap((p) => p.projects), [providers]);
  const allSyncErrors = useMemo(
    () => allProjects.map((p) => parseSyncErrorInfo(p.syncError)).filter((e): e is SyncErrorInfo => e !== null),
    [allProjects]
  );

  const prevIsSyncingRef = useRef(isSyncing);
  /** Tracks whether the initial-mount notification has already been emitted. */
  const initialNotificationSent = useRef(false);

  useEffect(() => {
    /** Emits one message per sync error into the shared message queue. */
    function emitErrors() {
      for (const errorInfo of allSyncErrors) {
        const isRateLimit = errorInfo.cause === SyncErrorCause.RATE_LIMIT;
        addMessage(isRateLimit ? "warning" : "error", formatSyncErrorMessage(errorInfo, tSync));
      }
    }

    // On initial mount: if not currently syncing and errors already exist,
    // emit notifications immediately so users see them without needing a sync cycle.
    if (!initialNotificationSent.current) {
      initialNotificationSent.current = true;
      if (!isSyncing) { emitErrors(); }
      return;
    }

    // On subsequent renders: emit notifications when a sync transitions from running to finished.
    const wasJustFinished = prevIsSyncingRef.current && !isSyncing;
    if (!wasJustFinished) { return; }
    emitErrors();
  }, [isSyncing, allSyncErrors, addMessage, tSync]);

  // Update ref after the effect so it always reflects the latest render value.
  useEffect(() => {
    prevIsSyncingRef.current = isSyncing;
  }, [isSyncing]);

  if (providers.length === 0) { return null; }

  return (
    <Button
      variant="outlined"
      size="small"
      disabled={isSyncing || providers.length === 0}
      onClick={onSyncNow}
      startIcon={
        <SyncIcon
          sx={
            isSyncing
              ? {
                  animation: "spin 1s linear infinite",
                  "@keyframes spin": {
                    "0%": { transform: "rotate(0deg)" },
                    "100%": { transform: "rotate(360deg)" },
                  },
                }
              : undefined
          }
        />
      }
    >
      {t("syncNow")}
    </Button>
  );
}
