"use client";

import { Box, Chip, Paper, Typography } from "@mui/material";
import TodayIcon from "@mui/icons-material/Today";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import TodayTaskItem from "./TodayTaskItem";

interface TodayIssue {
  id: string;
  externalId: string;
  title: string;
  dueDate: string | null;
  externalUrl: string;
  isUnassigned: boolean;
  todayOrder: number;
  providerCreatedAt: string | null;
  providerUpdatedAt: string | null;
  /**
   * Pin state carried through from the main issue list for type correctness.
   * The today area does not render a pin button — pin actions are only in the main task list.
   */
  pinned: boolean;
  project: {
    displayName: string;
    issueProvider: { iconUrl: string | null; displayName: string };
  };
}

/** Props for {@link TodayTasksArea}. */
interface TodayTasksAreaProps {
  /** Today's issues sorted by {@link TodayIssue.todayOrder}. */
  items: TodayIssue[];
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
 * @param onRemove - Callback invoked when the user removes an issue from today's list.
 * @param onComplete - Callback invoked when the user clicks the "Complete" button.
 * @returns A droppable area containing a sorted list of today task items.
 */
export default function TodayTasksArea({ items, onRemove, onComplete }: TodayTasksAreaProps) {
  const t = useTranslations("todayTasks");

  const ids = items.map((i) => i.id);

  const { setNodeRef, isOver } = useDroppable({ id: TODAY_DROP_ZONE_ID });

  return (
    <Box sx={{ mb: 3 }}>
      <Paper
        variant="outlined"
        sx={{
          borderRadius: 2,
          overflow: "hidden",
          borderColor: "#e5e7eb",
          bgcolor: "background.paper",
        }}
      >
        {/* Section header */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: "8px",
              bgcolor: "rgba(79, 70, 229, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <TodayIcon sx={{ fontSize: 16, color: "primary.main" }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="h6"
              component="h2"
              sx={{ fontSize: "0.9375rem", fontWeight: 600, color: "text.primary" }}
            >
              {t("title")}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {t("subtitle")}
            </Typography>
          </Box>
          <Chip
            label="TODAY'S FOCUS"
            size="small"
            sx={{
              bgcolor: "rgba(79, 70, 229, 0.08)",
              color: "primary.main",
              border: "none",
              fontWeight: 600,
              fontSize: "0.6875rem",
              letterSpacing: "0.04em",
              height: 22,
            }}
          />
        </Box>

        {/* Drop zone */}
        <Box
          ref={setNodeRef}
          sx={{
            p: 1.5,
            minHeight: 60,
            transition: "background-color 0.2s",
            bgcolor: isOver ? "rgba(79, 70, 229, 0.04)" : "transparent",
          }}
        >
          {items.length === 0 ? (
            <Box
              sx={{
                border: "1.5px dashed",
                borderColor: isOver ? "primary.main" : "#d1d5db",
                borderRadius: 1.5,
                py: 2,
                px: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "border-color 0.2s, background-color 0.2s",
                bgcolor: isOver ? "rgba(79, 70, 229, 0.04)" : "transparent",
              }}
            >
              <Typography variant="body2" color="text.secondary">
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
                  onRemove={onRemove}
                  onComplete={onComplete}
                />
              ))}
            </SortableContext>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
