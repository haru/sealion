"use client";

import { Box, Typography } from "@mui/material";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import AddIcon from "@mui/icons-material/Add";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import TodayTaskItem from "./TodayTaskItem";

/**
 * Shape of an issue displayed in the today tasks area.
 * Mirrors the relevant fields from the main issue list with today-specific ordering.
 */
interface TodayIssue {
  /** Internal issue ID. */
  id: string;
  /** External ID from the provider. */
  externalId: string;
  /** Issue title. */
  title: string;
  /** ISO 8601 due date string, or `null`. */
  dueDate: string | null;
  /** URL to the issue on the external provider. */
  externalUrl: string;
  /** Whether the issue has no assignee. */
  isUnassigned: boolean;
  /** Display order within today's list. */
  todayOrder: number;
  /** ISO 8601 datetime string from the issue provider, or `null` if unavailable. */
  providerCreatedAt: string | null;
  /** ISO 8601 datetime string from the issue provider, or `null` if unavailable. */
  providerUpdatedAt: string | null;
  /**
   * Pin state carried through from the main issue list for type correctness.
   * The today area does not render a pin button — pin actions are only in the main task list.
   */
  pinned: boolean;
  /** Project metadata including provider information. */
  project: {
    displayName: string;
    issueProvider: { iconUrl: string | null; displayName: string };
  };
}

/** Props for {@link TodayTasksArea}. */
interface TodayTasksAreaProps {
  /** Today's issues sorted by {@link TodayIssue.todayOrder}. */
  items: TodayIssue[];
  /** Whether to show the provider-created-at timestamp on each card. */
  showCreatedAt?: boolean;
  /** Whether to show the provider-updated-at timestamp on each card. */
  showUpdatedAt?: boolean;
  /** Called when the user removes an issue from today's list. */
  onRemove: (id: string) => void;
  /**
   * Called when the user clicks the "Complete" button on an issue card.
   * @param id - Internal issue ID.
   */
  onComplete?: (id: string) => void;
}

/** Drop zone ID used by dnd-kit to identify today's tasks droppable area. */
export const TODAY_DROP_ZONE_ID = "today-drop-zone";

/**
 * Drop zone and sortable list of today's flagged issues.
 * @param items - Issues to display, pre-sorted by `todayOrder`.
 * @param showCreatedAt - When true, each task card shows the provider-created-at timestamp.
 * @param showUpdatedAt - When true, each task card shows the provider-updated-at timestamp.
 * @param onRemove - Callback invoked when the user removes an issue from today's list.
 * @param onComplete - Callback invoked when the user clicks the "Complete" button.
 * @returns A droppable area containing a sorted list of today task items.
 */
export default function TodayTasksArea({ items, showCreatedAt, showUpdatedAt, onRemove, onComplete }: TodayTasksAreaProps) {
  const t = useTranslations("todayTasks");

  const ids = items.map((i) => i.id);

  const { setNodeRef, isOver } = useDroppable({ id: TODAY_DROP_ZONE_ID });

  return (
    <Box
      sx={{
        mb: 5,
        p: 3,
        borderRadius: "20px",
        bgcolor: isOver ? "rgba(79, 70, 229, 0.04)" : "background.default",
        border: "1px solid",
        borderColor: "divider",
        transition: "background-color 0.2s",
      }}
    >
      {/* Section header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 3,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              p: 1,
              bgcolor: "primary.main",
              borderRadius: "8px",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GpsFixedIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography
              variant="h5"
              component="h2"
              sx={{
                fontWeight: 800,
                letterSpacing: "-0.02em",
                fontSize: "1.25rem",
                color: "text.primary",
              }}
            >
              {t("title")}
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", fontWeight: 500 }}>
              {t("subtitle")}
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            bgcolor: "#eef2ff",
            color: "primary.main",
            borderRadius: "100px",
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.05em",
          }}
        >
          {t("focusBadge")}
        </Box>
      </Box>

      {/* Task list */}
      <Box ref={setNodeRef} role="region" aria-label={t("title")}>
        {items.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              py: 3,
              border: "2px dashed",
              borderColor: "divider",
              borderRadius: "12px",
              bgcolor: "rgba(255,255,255,0.4)",
              transition: "background-color 0.2s, border-color 0.2s",
              ...(isOver && { bgcolor: "rgba(255,255,255,0.6)", borderColor: "primary.main" }),
            }}
          >
            <Typography
              sx={{
                fontSize: "0.8rem",
                color: "text.secondary",
                display: "flex",
                alignItems: "center",
                gap: 0.75,
              }}
            >
              <AddIcon sx={{ fontSize: 16 }} />
              {t("empty")}
            </Typography>
          </Box>
        ) : (
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {items.map((issue) => (
              <TodayTaskItem
                key={issue.id}
                id={issue.id}
                externalId={issue.externalId}
                title={issue.title}
                dueDate={issue.dueDate}
                externalUrl={issue.externalUrl}
                isUnassigned={issue.isUnassigned}
                providerCreatedAt={issue.providerCreatedAt}
                providerUpdatedAt={issue.providerUpdatedAt}
                providerIconUrl={issue.project.issueProvider.iconUrl}
                providerName={issue.project.issueProvider.displayName}
                projectName={issue.project.displayName}
                pinned={issue.pinned}
                showCreatedAt={showCreatedAt}
                showUpdatedAt={showUpdatedAt}
                onRemove={onRemove}
                onComplete={onComplete}
              />
            ))}
          </SortableContext>
        )}
      </Box>
    </Box>
  );
}
