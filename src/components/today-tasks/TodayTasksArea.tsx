"use client";

import { Box, Paper, Typography } from "@mui/material";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import TodayTaskItem from "./TodayTaskItem";
import type { Status } from "@/lib/types";

interface TodayIssue {
  id: string;
  externalId: string;
  title: string;
  status: Status;
  dueDate: string | null;
  externalUrl: string;
  isUnassigned: boolean;
  todayOrder: number;
  providerCreatedAt: string | null;
  providerUpdatedAt: string | null;
  project: {
    displayName: string;
    issueProvider: { iconUrl: string | null; displayName: string };
  };
}

interface TodayTasksAreaProps {
  items: TodayIssue[];
  onRemove: (id: string) => void;
  onStatusChange: (id: string, newStatus: Status) => void;
}

/** Drop zone ID used by dnd-kit to identify today's tasks droppable area. */
export const TODAY_DROP_ZONE_ID = "today-drop-zone";

/**
 * Drop zone and sortable list of today's flagged issues.
 * @param items - Issues to display, pre-sorted by `todayOrder`.
 * @param onRemove - Callback invoked when the user removes an issue from today's list.
 * @param onStatusChange - Callback invoked when the user changes an issue's status.
 * @returns A droppable area containing a sorted list of today task items.
 */
export default function TodayTasksArea({ items, onRemove, onStatusChange }: TodayTasksAreaProps) {
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
                status={issue.status}
                dueDate={issue.dueDate}
                externalUrl={issue.externalUrl}
                isUnassigned={issue.isUnassigned}
                providerCreatedAt={issue.providerCreatedAt}
                providerUpdatedAt={issue.providerUpdatedAt}
                providerIconUrl={issue.project.issueProvider.iconUrl}
                providerName={issue.project.issueProvider.displayName}
                projectName={issue.project.displayName}
                onRemove={onRemove}
                onStatusChange={onStatusChange}
              />
            ))}
          </SortableContext>
        )}
      </Paper>
    </Box>
  );
}
