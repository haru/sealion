"use client";

import { Box, Paper, Typography } from "@mui/material";
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
      <Typography variant="h6" component="h2" gutterBottom>
        {t("title")}
      </Typography>

      <Paper
        ref={setNodeRef}
        variant="outlined"
        sx={{
          p: 2,
          minHeight: 80,
          borderStyle: "dashed",
          borderColor: isOver ? "primary.main" : "divider",
          bgcolor: isOver ? "action.hover" : "background.paper",
          transition: "border-color 0.2s, background-color 0.2s",
        }}
      >
        {items.length === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: "center", py: 1 }}
          >
            {t("empty")}
          </Typography>
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
      </Paper>
    </Box>
  );
}
