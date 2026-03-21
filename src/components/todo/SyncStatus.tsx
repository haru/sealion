"use client";

import { Box, Chip, Snackbar, Alert } from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import WarningIcon from "@mui/icons-material/Warning";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

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
}

/** Displays the sync status chip and error snackbars for all providers. */
export default function SyncStatus({ providers, isSyncing }: SyncStatusProps) {
  const t = useTranslations("todo");
  const tErrors = useTranslations("errors");

  const [openRateLimit, setOpenRateLimit] = useState(false);
  const [openSyncFailed, setOpenSyncFailed] = useState(false);

  const allProjects = providers.flatMap((p) => p.projects);
  const hasRateLimit = allProjects.some((p) => p.syncError === "RATE_LIMITED");
  const hasSyncFailed = allProjects.some((p) => p.syncError === "SYNC_FAILED");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isSyncing && hasRateLimit) setOpenRateLimit(true);
  }, [isSyncing, hasRateLimit]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isSyncing && hasSyncFailed) setOpenSyncFailed(true);
  }, [isSyncing, hasSyncFailed]);

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
    <>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
        <Chip icon={icon} label={label} size="small" variant="outlined" />
      </Box>

      <Snackbar
        open={openRateLimit}
        autoHideDuration={6000}
        onClose={() => setOpenRateLimit(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setOpenRateLimit(false)} severity="warning" sx={{ width: "100%" }}>
          {tErrors("RATE_LIMITED")}
        </Alert>
      </Snackbar>

      <Snackbar
        open={openSyncFailed}
        autoHideDuration={8000}
        onClose={() => setOpenSyncFailed(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setOpenSyncFailed(false)} severity="error" sx={{ width: "100%" }}>
          {tErrors("SYNC_FAILED")}
        </Alert>
      </Snackbar>
    </>
  );
}
