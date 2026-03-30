"use client";

import { IconButton, Tooltip } from "@mui/material";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import IssueCard from "@/components/IssueCard";

/** Props for {@link TodayTaskItem}. */
interface TodayTaskItemProps {
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
  /** Provider icon URL or `null`. */
  providerIconUrl: string | null;
  /** Display name of the issue provider. */
  providerName: string;
  /** Display name of the project. */
  projectName: string;
  /** ISO 8601 datetime string from the issue provider, or `null` if unavailable. */
  providerCreatedAt: string | null;
  /** ISO 8601 datetime string from the issue provider, or `null` if unavailable. */
  providerUpdatedAt: string | null;
  /**
   * Whether the issue is currently pinned.
   * Accepted for type correctness when flowing issues from the main list into the today area.
   * A pin button is intentionally NOT rendered here — pinning is only available in the main task list.
   */
  pinned: boolean;
  /** Whether to show the provider-created-at timestamp. */
  showCreatedAt?: boolean;
  /** Whether to show the provider-updated-at timestamp. */
  showUpdatedAt?: boolean;
  /** Called when the user removes the issue from today's list. */
  onRemove: (id: string) => void;
  /**
   * Called when the user clicks the "Complete" button on the issue card.
   * @param id - Internal issue ID.
   */
  onComplete?: (id: string) => void;
}

/** Draggable today-task item with a remove button and complete button, wrapping {@link IssueCard}. */
export default function TodayTaskItem({
  id,
  externalId,
  title,
  dueDate,
  externalUrl,
  isUnassigned,
  providerIconUrl,
  providerName,
  projectName,
  providerCreatedAt,
  providerUpdatedAt,
  showCreatedAt,
  showUpdatedAt,
  onRemove,
  onComplete,
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
      dueDate={dueDate}
      externalUrl={externalUrl}
      isUnassigned={isUnassigned}
      providerIconUrl={providerIconUrl}
      providerName={providerName}
      projectName={projectName}
      providerCreatedAt={providerCreatedAt}
      providerUpdatedAt={providerUpdatedAt}
      showCreatedAt={showCreatedAt}
      showUpdatedAt={showUpdatedAt}
      actionButton={actionButton}
      dragContainerRef={setNodeRef}
      dragHandleAttributes={attributes}
      dragHandleListeners={listeners}
      dragStyle={dragStyle}
      isGhost={isDragging}
      isToday
      onComplete={onComplete}
    />
  );
}
