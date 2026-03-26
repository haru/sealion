"use client";

import { Box, Button, Chip } from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import WarningIcon from "@mui/icons-material/Warning";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { useMessageQueue } from "@/components/MessageQueue";

interface Project {
  id: string;
  displayName: string;
  lastSyncedAt: string | null;
  syncError: string | null;
}

interface ProviderStatus {
  id: string;
  displayName: string;
  type: string;
  projects: Project[];
}

interface SyncStatusProps {
  providers: ProviderStatus[];
  isSyncing: boolean;
  /** Callback invoked when the user clicks the "Sync Now" button. */
  onSyncNow: () => void;
}

/** Displays the sync status chip and a "Sync Now" button. Errors are shown via the shared message queue. */
export default function SyncStatus({ providers, isSyncing, onSyncNow }: SyncStatusProps) {
  const t = useTranslations("todo");
  const tErrors = useTranslations("errors");
  const { addMessage } = useMessageQueue();

  const allProjects = providers.flatMap((p) => p.projects);
  const hasRateLimit = allProjects.some((p) => p.syncError === "RATE_LIMITED");
  const hasSyncFailed = allProjects.some((p) => p.syncError === "SYNC_FAILED");

  const prevIsSyncing = useRef(isSyncing);

  useEffect(() => {
    const wasJustFinished = prevIsSyncing.current && !isSyncing;
    prevIsSyncing.current = isSyncing;
    if (!wasJustFinished) return;
    if (hasRateLimit) addMessage("warning", tErrors("RATE_LIMITED"));
    if (hasSyncFailed) addMessage("error", tErrors("SYNC_FAILED"));
  }, [isSyncing, hasRateLimit, hasSyncFailed, addMessage, tErrors]);

  if (providers.length === 0) return null;

  const lastSynced = allProjects
    .map((p) => p.lastSyncedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  const hasError = allProjects.some((p) => p.syncError !== null);

  const icon = isSyncing ? (
    <SyncIcon
      sx={{
        animation: "spin 1s linear infinite",
        "@keyframes spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      }}
    />
  ) : hasError ? (
    <ErrorIcon color="error" />
  ) : lastSynced ? (
    <CheckCircleIcon color="success" />
  ) : (
    <WarningIcon color="warning" />
  );

  const label = isSyncing
    ? t("syncInProgress")
    : lastSynced
      ? t("lastSynced", { time: new Date(lastSynced).toLocaleTimeString() })
      : t("notSyncedYet");

  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
      <Chip icon={icon} label={label} size="small" variant="outlined" />
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
    </Box>
  );
}
