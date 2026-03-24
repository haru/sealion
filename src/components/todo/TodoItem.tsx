"use client";

import { IconButton, Tooltip } from "@mui/material";
import TodayIcon from "@mui/icons-material/Today";
import { useDraggable } from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import IssueCard from "@/components/IssueCard";
import type { Status } from "@/lib/types";

interface TodoItemProps {
  id: string;
  externalId: string;
  title: string;
  status: Status;
  dueDate: string | null;
  externalUrl: string;
  isUnassigned: boolean;
  providerIconUrl: string | null;
  providerName: string;
  projectName: string;
  /** ISO 8601 datetime string from the issue provider, or `null` if unavailable. */
  providerCreatedAt: string | null;
  /** ISO 8601 datetime string from the issue provider, or `null` if unavailable. */
  providerUpdatedAt: string | null;
  onStatusChange?: (id: string, newStatus: Status) => void;
  onAddToToday?: (id: string) => void;
}

/** Draggable issue list item with an "add to today" action, wrapping {@link IssueCard}. */
export default function TodoItem({
  id,
  externalId,
  title,
  status,
  dueDate,
  externalUrl,
  isUnassigned,
  providerIconUrl,
  providerName,
  projectName,
  providerCreatedAt,
  providerUpdatedAt,
  onStatusChange,
  onAddToToday,
}: TodoItemProps) {
  const tToday = useTranslations("todayTasks");

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { type: "todo-item", issueId: id },
  });

  const isComplete = status === "CLOSED";

  const actionButton =
    onAddToToday && !isComplete ? (
      <Tooltip title={tToday("addToToday")}>
        <IconButton
          size="small"
          onClick={() => onAddToToday(id)}
          aria-label={tToday("addToToday")}
        >
          <TodayIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    ) : null;

  return (
    <IssueCard
      id={id}
      externalId={externalId}
      title={title}
      status={status}
      dueDate={dueDate}
      externalUrl={externalUrl}
      isUnassigned={isUnassigned}
      providerIconUrl={providerIconUrl}
      providerName={providerName}
      projectName={projectName}
      providerCreatedAt={providerCreatedAt}
      providerUpdatedAt={providerUpdatedAt}
      actionButton={actionButton}
      dragContainerRef={setNodeRef}
      dragHandleAttributes={attributes}
      dragHandleListeners={listeners}
      isDragging={isDragging}
      onStatusChange={onStatusChange}
    />
  );
}
