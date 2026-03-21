"use client";

import { Box, Paper, Typography } from "@mui/material";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import TodayTaskItem from "./TodayTaskItem";
import type { Priority, Status } from "@/lib/types";

interface TodayIssue {
  id: string;
  externalId: string;
  title: string;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  externalUrl: string;
  isUnassigned: boolean;
  todayOrder: number;
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

/** Drop zone ID used by dnd-kit to identify the today's tasks droppable area. */
export const TODAY_DROP_ZONE_ID = "today-drop-zone";

/**
 * Drop zone and sortable list of today's flagged issues.
 * @param props.items - Issues to display, sorted by `todayOrder`.
 * @param props.onRemove - Callback invoked when the user removes an issue from today's list.
 * @param props.onStatusChange - Callback invoked when the user changes an issue's status.
 * @returns A droppable area containing a sorted list of today task items.
 */
export default function TodayTasksArea({ items, onRemove, onStatusChange }: TodayTasksAreaProps) {
  const t = useTranslations("todayTasks");

  const sorted = [...items].sort((a, b) => a.todayOrder - b.todayOrder);
  const ids = sorted.map((i) => i.id);

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
        {sorted.length === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: "center", py: 1 }}
          >
            {t("empty")}
          </Typography>
        ) : (
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {sorted.map((issue) => (
              <TodayTaskItem
                key={issue.id}
                id={issue.id}
                externalId={issue.externalId}
                title={issue.title}
                status={issue.status}
                priority={issue.priority}
                dueDate={issue.dueDate}
                externalUrl={issue.externalUrl}
                isUnassigned={issue.isUnassigned}
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
