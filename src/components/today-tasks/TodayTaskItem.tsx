"use client";

import { IconButton, Tooltip } from "@mui/material";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import IssueCard from "@/components/IssueCard";
import type { Priority, Status } from "@/lib/types";

interface TodayTaskItemProps {
  id: string;
  externalId: string;
  title: string;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  externalUrl: string;
  isUnassigned: boolean;
  providerIconUrl: string | null;
  providerName: string;
  projectName: string;
  onRemove: (id: string) => void;
  onStatusChange?: (id: string, newStatus: Status) => void;
}

/** Draggable today-task item with a remove button, wrapping {@link IssueCard}. */
export default function TodayTaskItem({
  id,
  externalId,
  title,
  status,
  priority,
  dueDate,
  externalUrl,
  isUnassigned,
  providerIconUrl,
  providerName,
  projectName,
  onRemove,
  onStatusChange,
}: TodayTaskItemProps) {
  const t = useTranslations("todayTasks");

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: "today-item", issueId: id },
  });

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const actionButton = (
    <Tooltip title={t("remove")}>
      <IconButton
        size="small"
        onClick={() => onRemove(id)}
        aria-label={t("remove")}
      >
        <RemoveCircleOutlineIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );

  return (
    <IssueCard
      id={id}
      externalId={externalId}
      title={title}
      status={status}
      priority={priority}
      dueDate={dueDate}
      externalUrl={externalUrl}
      isUnassigned={isUnassigned}
      providerIconUrl={providerIconUrl}
      providerName={providerName}
      projectName={projectName}
      actionButton={actionButton}
      dragContainerRef={setNodeRef}
      dragHandleAttributes={attributes}
      dragHandleListeners={listeners}
      dragStyle={dragStyle}
      isGhost={isDragging}
      onStatusChange={onStatusChange}
    />
  );
}
