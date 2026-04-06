"use client";

import { type DragEndEvent, type DragMoveEvent, type DragStartEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useMemo, useState } from "react";

import { TODAY_DROP_ZONE_ID } from "@/components/today-tasks/TodayTasksArea";
import type { ClientIssue } from "@/types/issue";

/** Options for {@link useDashboardDnD}. */
interface UseDashboardDnDOptions {
  /** All regular issues. */
  issues: ClientIssue[];
  /** Today's issues sorted by todayOrder. */
  todayIssuesSorted: ClientIssue[];
  /** Adds an issue to today's list. */
  handleAddToToday: (id: string) => Promise<void>;
  /** Removes an issue from today's list. */
  handleRemoveFromToday: (id: string) => Promise<void>;
  /** Reorders today's issues. */
  handleReorder: (orderedIds: string[]) => Promise<void>;
}

/** Return value of {@link useDashboardDnD}. */
interface UseDashboardDnDResult {
  /** Currently dragged issue, for rendering the drag overlay. */
  activeIssue: ClientIssue | undefined;
  /** Whether the dragged today-item is outside the today drop zone. */
  isDraggingOutside: boolean;
  /** Handles drag start event. */
  handleDragStart: (event: DragStartEvent) => void;
  /** Handles drag move event (tracks outside-drop-zone state). */
  handleDragMove: (event: DragMoveEvent) => void;
  /** Handles drag cancel event. */
  handleDragCancel: () => void;
  /** Handles drag end event (add to today, reorder, or remove). */
  handleDragEnd: (event: DragEndEvent) => void;
}

/**
 * Manages drag-and-drop interactions for moving issues between the todo list and today's tasks.
 * @param options - DnD callbacks and issue data required by the handlers.
 * @returns DnD event handlers and derived state.
 */
export function useDashboardDnD({
  issues,
  todayIssuesSorted,
  handleAddToToday,
  handleRemoveFromToday,
  handleReorder,
}: UseDashboardDnDOptions): UseDashboardDnDResult {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isDraggingOutside, setIsDraggingOutside] = useState(false);

  const activeIssue = useMemo(
    () => (activeDragId ? [...issues, ...todayIssuesSorted].find((i) => i.id === activeDragId) : undefined),
    [activeDragId, issues, todayIssuesSorted],
  );

  /** Tracks the active dragged issue ID on drag start for both todo-items and today-items. */
  function handleDragStart(event: DragStartEvent) {
    const activeData = event.active.data.current as { type: string; issueId: string } | undefined;
    if (activeData?.type === "todo-item" || activeData?.type === "today-item") {
      setActiveDragId(activeData.issueId);
    }
  }

  /**
   * Tracks whether the dragged today-item is currently over a valid drop zone.
   * @param event - dnd-kit DragMoveEvent.
   */
  function handleDragMove(event: DragMoveEvent) {
    const activeData = event.active.data.current as { type: string } | undefined;
    if (activeData?.type === "today-item") {
      const isOver =
        event.over?.id === TODAY_DROP_ZONE_ID ||
        (event.over?.data.current as { type?: string } | undefined)?.type === "today-item";
      setIsDraggingOutside((prev) => {
        const next = !isOver;
        return prev === next ? prev : next;
      });
    } else {
      setIsDraggingOutside((prev) => (prev ? false : prev));
    }
  }

  /** Resets drag state when a drag operation is cancelled (e.g. via Escape key). */
  function handleDragCancel() {
    setActiveDragId(null);
    setIsDraggingOutside(false);
  }

  /** Handles drop — adds to today, reorders within today, or removes on drop-outside. */
  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    const activeData = active.data.current as { type: string; issueId: string } | undefined;
    if (!activeData) { return; }

    const overData = over?.data.current as { type?: string } | undefined;
    const isOverTodayArea = over?.id === TODAY_DROP_ZONE_ID || overData?.type === "today-item";

    if (activeData.type === "todo-item" && over && isOverTodayArea) {
      void handleAddToToday(activeData.issueId);
      return;
    }

    if (activeData.type === "today-item") {
      setIsDraggingOutside(false);
      if (!over || !isOverTodayArea) {
        void handleRemoveFromToday(activeData.issueId);
        return;
      }
      if (active.id !== over.id) {
        const ids = todayIssuesSorted.map((i) => i.id);
        const oldIndex = ids.indexOf(active.id as string);
        const newIndex = ids.indexOf(over.id as string);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          void handleReorder(arrayMove(ids, oldIndex, newIndex));
        }
      }
    }
  }

  return {
    activeIssue,
    isDraggingOutside,
    handleDragStart,
    handleDragMove,
    handleDragCancel,
    handleDragEnd,
  };
}
