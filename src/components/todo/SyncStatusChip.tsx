"use client";

import ErrorIcon from "@mui/icons-material/Error";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import SyncIcon from "@mui/icons-material/Sync";
import WarningIcon from "@mui/icons-material/Warning";
import { Chip } from "@mui/material";
import { useTranslations } from "next-intl";
import React, { useMemo } from "react";

import { parseSyncErrorInfo } from "@/lib/sync/error-utils";
import { type SyncErrorInfo } from "@/lib/types";

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

/** Props for the {@link SyncStatusChip} component. */
export interface SyncStatusChipProps {
  /** List of sync providers with their project sync state. */
  providers: ProviderStatus[];
  /** Whether a sync is currently in progress. */
  isSyncing: boolean;
}

/**
 * Compact chip displayed next to the page title showing the last sync time.
 * Returns `null` when no providers are configured.
 *
 * @param props - Providers list and syncing flag.
 * @returns A green filled chip with a dot icon when synced, or appropriate status variants.
 */
export default function SyncStatusChip({ providers, isSyncing }: SyncStatusChipProps) {
  const t = useTranslations("todo");

  const allProjects = useMemo(() => providers.flatMap((p) => p.projects), [providers]);
  const allSyncErrors = useMemo(
    () => allProjects.map((p) => parseSyncErrorInfo(p.syncError)).filter((e): e is SyncErrorInfo => e !== null),
    [allProjects],
  );

  if (providers.length === 0) { return null; }

  const lastSynced = allProjects
    .map((p) => p.lastSyncedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  const hasError = allSyncErrors.length > 0;

  type ChipColor = "success" | "warning" | "error" | "default";
  let icon: React.ReactElement;
  let color: ChipColor;

  if (isSyncing) {
    icon = (
      <SyncIcon
        sx={{
          animation: "spin 1s linear infinite",
          "@keyframes spin": {
            "0%": { transform: "rotate(0deg)" },
            "100%": { transform: "rotate(360deg)" },
          },
        }}
      />
    );
    color = "default";
  } else if (hasError) {
    icon = <ErrorIcon />;
    color = "error";
  } else if (lastSynced) {
    icon = <FiberManualRecordIcon sx={{ fontSize: "0.6rem !important" }} />;
    color = "success";
  } else {
    icon = <WarningIcon />;
    color = "warning";
  }

  let label: string;
  if (isSyncing) {
    label = t("syncInProgress");
  } else if (lastSynced) {
    label = t("lastSynced", { time: new Date(lastSynced).toLocaleTimeString() });
  } else {
    label = t("notSyncedYet");
  }

  return (
    <Chip
      data-testid="sync-status-chip"
      icon={icon}
      label={label}
      size="small"
      color={color}
      sx={{
        borderRadius: "100px",
        fontWeight: 700,
        fontSize: "0.7rem",
        letterSpacing: "0.05em",
        ...(color === "success" && {
          bgcolor: "#e8f5e9",
          color: "#2e7d32",
          "& .MuiChip-icon": { color: "#2e7d32" },
        }),
      }}
    />
  );
}
