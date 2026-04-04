"use client";

import { useDraggable } from "@dnd-kit/core";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import TodayIcon from "@mui/icons-material/Today";
import { Box, IconButton, Tooltip } from "@mui/material";
import { useTranslations } from "next-intl";

import IssueCard from "@/components/IssueCard";

/** Props for {@link TodoItem}. */
interface TodoItemProps {
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
  /** When true, the provider creation timestamp chip is rendered. Defaults to false. */
  showCreatedAt?: boolean;
  /** When true, the provider update timestamp chip is rendered. Defaults to false. */
  showUpdatedAt?: boolean;
  /** Whether the issue is currently pinned to the top of the list. */
  pinned: boolean;
  /**
   * Called when the user clicks the "Complete" button on the issue card.
   * @param id - Internal issue ID.
   */
  onComplete?: (id: string) => void;
  /** Called when the user adds the issue to today's task list. */
  onAddToToday?: (id: string) => void;
  /**
   * Called when the user toggles the pin state of the issue.
   * @param id - Internal issue ID.
   * @param pinned - The new pinned state to apply.
   */
  onTogglePin?: (id: string, pinned: boolean) => void;
}

/** Draggable issue list item with pin, "add to today", and complete buttons, wrapping {@link IssueCard}. */
export default function TodoItem({
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
  pinned,
  onComplete,
  onAddToToday,
  onTogglePin,
}: TodoItemProps) {
  const tToday = useTranslations("todayTasks");
  const tTodo = useTranslations("todo");

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { type: "todo-item", issueId: id },
  });

  const pinButton = onTogglePin ? (
    <Tooltip title={pinned ? tTodo("unpin") : tTodo("pin")}>
      <IconButton
        size="small"
        onClick={() => onTogglePin(id, !pinned)}
        aria-label={pinned ? tTodo("unpin") : tTodo("pin")}
      >
        {pinned ? (
          <PushPinIcon fontSize="small" color="error" />
        ) : (
          <PushPinOutlinedIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  ) : null;

  const actionButton =
    onAddToToday ? (
      <Box sx={{ display: "flex", alignItems: "center" }}>
        {pinButton}
        <Tooltip title={tToday("addToToday")}>
          <IconButton
            size="small"
            onClick={() => onAddToToday(id)}
            aria-label={tToday("addToToday")}
          >
            <TodayIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    ) : pinButton;

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
      isDragging={isDragging}
      onComplete={onComplete}
    />
  );
}
