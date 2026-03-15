"use client";

import { Box, Chip, Snackbar, Alert, Tooltip } from "@mui/material";
import SyncIcon from "@mui/icons-material/Sync";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

interface Project {
  id: string;
  displayName: string;
  lastSyncedAt: string | null;
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
  showRateLimit?: boolean;
  onRateLimitClose?: () => void;
}

export default function SyncStatus({
  providers,
  isSyncing,
  showRateLimit,
  onRateLimitClose,
}: SyncStatusProps) {
  const t = useTranslations("todo");
  const tErrors = useTranslations("errors");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (showRateLimit) setOpen(true);
  }, [showRateLimit]);

  function handleClose() {
    setOpen(false);
    onRateLimitClose?.();
  }

  if (providers.length === 0) return null;

  return (
    <>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
        {providers.map((provider) => {
          const lastSynced = provider.projects
            .map((p) => p.lastSyncedAt)
            .filter(Boolean)
            .sort()
            .at(-1);

          const label = isSyncing
            ? t("syncInProgress")
            : lastSynced
              ? t("lastSynced", {
                  time: new Date(lastSynced).toLocaleTimeString(),
                })
              : provider.displayName;

          const icon = isSyncing ? (
            <SyncIcon sx={{ animation: "spin 1s linear infinite" }} />
          ) : lastSynced ? (
            <CheckCircleIcon color="success" />
          ) : (
            <ErrorIcon color="warning" />
          );

          return (
            <Tooltip key={provider.id} title={provider.displayName}>
              <Chip icon={icon} label={label} size="small" variant="outlined" />
            </Tooltip>
          );
        })}
      </Box>

      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={handleClose} severity="warning" sx={{ width: "100%" }}>
          {tErrors("RATE_LIMITED")}
        </Alert>
      </Snackbar>
    </>
  );
}
