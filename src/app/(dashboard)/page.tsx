"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Box, Typography } from "@mui/material";
import InboxIcon from "@mui/icons-material/Inbox";
import { useMessageQueue } from "@/hooks/useMessageQueue";
import { useTranslations } from "next-intl";
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import IssueCard from "@/components/IssueCard";
import TodoList from "@/components/todo/TodoList";
import SyncStatus from "@/components/todo/SyncStatus";
import CompleteIssueModal from "@/components/todo/CompleteIssueModal";
import TodayTasksArea, { TODAY_DROP_ZONE_ID } from "@/components/today-tasks/TodayTasksArea";
import TaskSearchBar from "@/components/search/TaskSearchBar";
import { allProjectsProcessed, shouldThrottleSync, SYNC_THROTTLE_MS } from "@/lib/sync-utils";
import { sortIssues } from "@/lib/sort-utils";
import { BoardSettings, DEFAULT_BOARD_SETTINGS, SortCriterion } from "@/lib/types";
import { useTaskSearch } from "@/hooks/useTaskSearch";
import { serializeKeywords } from "@/lib/search-parser";

interface Issue {
  id: string;
  externalId: string;
  title: string;
  dueDate: string | null;
  externalUrl: string;
  isUnassigned: boolean;
  todayFlag: boolean;
  todayOrder: number | null;
  todayAddedAt: string | null;
  providerCreatedAt: string | null;
  providerUpdatedAt: string | null;
  /** Whether the user has pinned this issue to the top of the list. */
  pinned: boolean;
  project: {
    displayName: string;
    issueProvider: { iconUrl: string | null; displayName: string };
  };
}

interface SyncProject {
  id: string;
  displayName: string;
  lastSyncedAt: string | null;
  syncError: string | null;
}

interface SyncProvider {
  id: string;
  displayName: string;
  type: string;
  projects: SyncProject[];
}

/** Main dashboard page showing today's tasks and the full issue list with drag-and-drop support. */
export default function DashboardPage() {
  const t = useTranslations("todo");
  const tToday = useTranslations("todayTasks");
  const tBoardSettings = useTranslations("boardSettings");
  const { addMessage } = useMessageQueue();

  const [issues, setIssues] = useState<Issue[]>([]);
  const [todayIssues, setTodayIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProviders, setSyncProviders] = useState<SyncProvider[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isDraggingOutside, setIsDraggingOutside] = useState(false);
  const [completeModalIssueId, setCompleteModalIssueId] = useState<string | null>(null);
  const [boardSettings, setBoardSettings] = useState<BoardSettings>(DEFAULT_BOARD_SETTINGS);
  const boardSettingsSortOrderRef = useRef<SortCriterion[]>(DEFAULT_BOARD_SETTINGS.sortOrder);
  const syncStartedAtRef = useRef<Date | null>(null);

  const {
    rawQuery,
    debouncedQuery,
    setRawQuery,
    clearSearch,
  } = useTaskSearch();

  const sensors = useSensors(useSensor(PointerSensor));

  /** Provider types available in the user's connected providers, for the filter dropdown. */
  const availableProviderTypes = useMemo(
    () => [...new Set(syncProviders.map((p) => p.type))],
    [syncProviders]
  );

  /** Project display names for the filter dropdown. */
  const availableProjectNames = useMemo(
    () => [...new Set(syncProviders.flatMap((p) => p.projects.map((proj) => proj.displayName)))],
    [syncProviders]
  );

  const todayIssuesSorted = useMemo(
    () =>
      todayIssues
        .map((i) => ({ ...i, todayOrder: i.todayOrder ?? 0 }))
        .sort((a, b) => a.todayOrder - b.todayOrder),
    [todayIssues]
  );

  const activeIssue = useMemo(
    () => (activeDragId ? [...issues, ...todayIssues].find((i) => i.id === activeDragId) : undefined),
    [activeDragId, issues, todayIssues]
  );

  const fetchIssues = useCallback(
    async (
      p: number,
      sortOrder?: SortCriterion[],
      searchQuery?: typeof debouncedQuery
    ) => {
      const order = sortOrder ?? boardSettingsSortOrderRef.current;
      const sortParam = order.join(",");
      const q = searchQuery ?? debouncedQuery;

      const params = new URLSearchParams({
        page: String(p),
        limit: "20",
        sortOrder: sortParam,
      });

      if (q.keywords.length > 0) params.set("q", serializeKeywords(q.keywords));
      if (q.provider) params.set("provider", q.provider);
      if (q.project) params.set("project", q.project);
      if (q.dueDateFilter) params.set("dueDateRange", q.dueDateFilter.preset);
      if (q.createdFilter) params.set("createdRange", q.createdFilter.preset);
      if (q.updatedFilter) params.set("updatedRange", q.updatedFilter.preset);
      if (q.assignee) params.set("assignee", q.assignee);

      try {
        const res = await fetch(`/api/issues?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          setIssues(json.data.items);
          setTotal(json.data.total);
        }
      } catch {
        // Silently skip — the polling loop or user will retry
      }
    },
    [debouncedQuery]
  );

  const fetchTodayIssues = useCallback(async () => {
    try {
      const res = await fetch("/api/issues/today");
      if (res.ok) {
        const json = await res.json();
        setTodayIssues(json.data.items);
      }
    } catch {
      // Silently skip — the polling loop or user will retry
    }
  }, []);

  // Re-fetch issues whenever the debounced search/filter query changes.
  // Skip on initial mount (loading === true) — the init() call handles the first fetch.
  const isInitialMountRef = useRef(true);
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    void fetchIssues(1);
    setPage(1);
  }, [debouncedQuery, fetchIssues]);

  const startSync = useCallback(async () => {
    syncStartedAtRef.current = new Date();
    setIsSyncing(true);
    try {
      await fetch("/api/sync", { method: "POST" });
    } catch {
      setIsSyncing(false);
      addMessage("error", t("syncNow"));
    }
  }, [addMessage, t]);

  useEffect(() => {
    if (!isSyncing) return;

    let cancelled = false;
    let pollTimeout: ReturnType<typeof setTimeout>;

    /** Polls the sync status endpoint and refreshes issues when all providers have synced. */
    async function poll() {
      if (cancelled) return;

      const syncRes = await fetch("/api/sync");
      if (!cancelled && syncRes.ok) {
        const json = await syncRes.json();
        const providers: SyncProvider[] = json.data;
        setSyncProviders(providers);

        const since = syncStartedAtRef.current;
        if (since && allProjectsProcessed(providers, since)) {
          if (!cancelled) await Promise.all([fetchIssues(page), fetchTodayIssues()]);
          setIsSyncing(false);
          return;
        }
      }

      if (!cancelled) {
        pollTimeout = setTimeout(poll, 5000);
      }
    }

    pollTimeout = setTimeout(poll, 5000);

    const safetyTimeout = setTimeout(() => {
      cancelled = true;
      setIsSyncing(false);
    }, 120000);

    return () => {
      cancelled = true;
      clearTimeout(pollTimeout);
      clearTimeout(safetyTimeout);
    };
  }, [isSyncing, page, fetchIssues, fetchTodayIssues]);

  const handleSyncNow = useCallback(() => {
    void startSync();
  }, [startSync]);

  useEffect(() => {
    /** Loads initial issue data and triggers a background sync unless throttled. */
    async function init() {
      setLoading(true);
      let fetchedProviders: SyncProvider[] = [];

      // Fetch board settings first so we can pass sortOrder to fetchIssues
      let initialSortOrder: SortCriterion[] = DEFAULT_BOARD_SETTINGS.sortOrder;
      try {
        const bsRes = await fetch("/api/board-settings");
        if (!bsRes.ok) {
          console.error("Failed to fetch board settings, falling back to defaults");
          addMessage("error", tBoardSettings("loadError"));
        } else {
          const bsJson = await bsRes.json();
          if (bsJson.error) {
            console.error(
              "Board settings API returned an error, falling back to defaults:",
              bsJson.error
            );
            addMessage("error", tBoardSettings("loadError"));
          } else if (bsJson.data) {
            const bs = bsJson.data as BoardSettings;
            setBoardSettings(bs);
            boardSettingsSortOrderRef.current = bs.sortOrder;
            initialSortOrder = bs.sortOrder;
          }
        }
      } catch (err) {
        console.error(
          "Unexpected error while fetching board settings, falling back to defaults",
          err instanceof Error ? err.message : String(err)
        );
      }

      try {
        await Promise.all([
          fetchIssues(1, initialSortOrder),
          fetchTodayIssues(),
          fetch("/api/sync").then(async (res) => {
            if (res.ok) {
              fetchedProviders = (await res.json()).data;
              setSyncProviders(fetchedProviders);
            }
          }),
        ]);
      } catch {
        // Individual fetch errors are handled inside each callback;
        // this guards against unexpected rejections from Promise.all itself.
      }
      setLoading(false);
      if (!shouldThrottleSync(fetchedProviders, SYNC_THROTTLE_MS)) {
        void startSync();
      }
    }
    void init();
  }, [fetchIssues, fetchTodayIssues, startSync, tBoardSettings, addMessage]);

  /** Fetches the requested page of issues. */
  async function handlePageChange(newPage: number) {
    setPage(newPage);
    await fetchIssues(newPage);
  }

  /**
   * Optimistically toggles the pinned state of an issue and persists it via the API.
   * On failure, rolls back the local state and shows an error notification.
   * @param id - Internal issue ID.
   * @param pinned - The new pinned state to apply.
   */
  async function handleTogglePin(id: string, pinned: boolean) {
    const original = issues.find((i) => i.id === id);
    if (!original) return;

    const rollback = () => {
      setIssues((prev) =>
        sortIssues(
          prev.map((i) => (i.id === id ? { ...i, pinned: original.pinned } : i)),
          boardSettingsSortOrderRef.current,
        ),
      );
      addMessage("error", t("pinToggleError"));
    };

    // Optimistic update
    setIssues((prev) =>
      sortIssues(
        prev.map((i) => (i.id === id ? { ...i, pinned } : i)),
        boardSettingsSortOrderRef.current,
      ),
    );

    try {
      const res = await fetch(`/api/issues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned }),
      });

      if (!res.ok) {
        rollback();
      }
    } catch {
      rollback();
    }
  }

  /** Opens the complete-issue modal for the given issue ID. */
  function handleComplete(id: string) {
    setCompleteModalIssueId(id);
  }

  /** Closes the complete-issue modal without taking action. */
  function handleModalCancel() {
    setCompleteModalIssueId(null);
  }

  /**
   * Confirms issue close from the modal. Posts comment if provided, then updates local state.
   * Throws on API failure so the modal can display an inline error.
   * @param issueId - Internal ID of the issue to close.
   * @param comment - Optional completion reason entered by the user.
   */
  async function handleModalConfirm(issueId: string, comment: string) {
    const originalInToday = todayIssues.find((i) => i.id === issueId);
    const originalInIssues = issues.find((i) => i.id === issueId);

    // Optimistic update: remove from both lists (closing deletes the issue)
    if (originalInToday) {
      setTodayIssues((prev) => prev.filter((i) => i.id !== issueId));
    }
    setIssues((prev) => prev.filter((issue) => issue.id !== issueId));

    const body: Record<string, unknown> = { closed: true };
    if (comment.trim()) body.comment = comment.trim();

    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        // Rollback optimistic update
        if (originalInToday) {
          setTodayIssues((prev) => {
            const exists = prev.some((i) => i.id === issueId);
            return exists
              ? prev.map((i) => (i.id === issueId ? originalInToday : i))
              : [...prev, originalInToday];
          });
        }
        if (originalInIssues) {
          setIssues((prev) => [originalInIssues, ...prev.filter((i) => i.id !== issueId)]);
        }
        throw new Error("EXTERNAL_UPDATE_FAILED");
      }
    } catch (err) {
      // Rollback on network error (but not if already rolled back above)
      if (!(err instanceof Error && err.message === "EXTERNAL_UPDATE_FAILED")) {
        if (originalInToday) {
          setTodayIssues((prev) => {
            const exists = prev.some((i) => i.id === issueId);
            return exists
              ? prev.map((i) => (i.id === issueId ? originalInToday : i))
              : [...prev, originalInToday];
          });
        }
        if (originalInIssues) {
          setIssues((prev) => [originalInIssues, ...prev.filter((i) => i.id !== issueId)]);
        }
      }
      throw err;
    }

    setCompleteModalIssueId(null);
  }

  /** Optimistically moves an issue into today's list and flags it via the API. */
  async function handleAddToToday(id: string) {
    const issueToAdd = issues.find((i) => i.id === id);
    if (!issueToAdd) return;

    const maxOrder = todayIssues.reduce((max, i) => Math.max(max, i.todayOrder ?? 0), 0);
    const optimisticItem = {
      ...issueToAdd,
      todayFlag: true,
      todayOrder: maxOrder + 1,
      todayAddedAt: new Date().toISOString(),
    };

    // Optimistic update: move from regular to today
    setIssues((prev) => prev.filter((i) => i.id !== id));
    setTodayIssues((prev) => [...prev, optimisticItem]);

    try {
      const res = await fetch(`/api/issues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todayFlag: true }),
      });

      if (res.ok) {
        const json = await res.json();
        setTodayIssues((prev) =>
          prev.map((issue) =>
            issue.id === id
              ? {
                  ...issue,
                  todayFlag: json.data.todayFlag,
                  todayOrder: json.data.todayOrder,
                  todayAddedAt: json.data.todayAddedAt,
                }
              : issue
          )
        );
        addMessage("information", tToday("addSuccess"));
      } else {
        // Rollback
        setTodayIssues((prev) => prev.filter((i) => i.id !== id));
        setIssues((prev) => [...prev, issueToAdd]);
        addMessage("error", tToday("addError"));
      }
    } catch {
      setTodayIssues((prev) => prev.filter((i) => i.id !== id));
      setIssues((prev) => [...prev, issueToAdd]);
      addMessage("error", tToday("addError"));
    }
  }

  /** Optimistically removes an issue from today's list and clears the flag via the API. */
  async function handleRemoveFromToday(id: string) {
    const issue = todayIssues.find((i) => i.id === id);
    if (!issue) return;

    // Optimistic update: remove from today
    setTodayIssues((prev) => prev.filter((i) => i.id !== id));

    try {
      const res = await fetch(`/api/issues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todayFlag: false }),
      });

      if (res.ok) {
        // Refetch regular issues so the item appears back in the list
        await fetchIssues(page);
        addMessage("information", tToday("removeSuccess"));
      } else {
        // Rollback
        setTodayIssues((prev) => [...prev, issue]);
        addMessage("error", tToday("removeError"));
      }
    } catch {
      setTodayIssues((prev) => [...prev, issue]);
      addMessage("error", tToday("removeError"));
    }
  }

  /** Optimistically reorders today's issues and persists the new order via the API. */
  async function handleReorder(orderedIds: string[]) {
    const prevTodayIssues = todayIssues;

    // Optimistic update: reassign todayOrder based on new positions
    setTodayIssues((prev) =>
      prev.map((issue) => {
        const newOrder = orderedIds.indexOf(issue.id);
        if (newOrder === -1) return issue;
        return { ...issue, todayOrder: newOrder + 1 };
      })
    );

    try {
      const res = await fetch("/api/issues/today/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });

      if (!res.ok) {
        setTodayIssues(prevTodayIssues);
        addMessage("error", tToday("reorderError"));
      }
    } catch {
      setTodayIssues(prevTodayIssues);
      addMessage("error", tToday("reorderError"));
    }
  }

  /** Tracks the active dragged issue ID on drag start for both todo-items and today-items. */
  function handleDragStart(event: DragStartEvent) {
    const activeData = event.active.data.current as { type: string; issueId: string } | undefined;
    if (activeData?.type === "todo-item" || activeData?.type === "today-item") {
      setActiveDragId(activeData.issueId);
    }
  }

  /**
   * Tracks whether the dragged today-item is currently over a valid drop zone.
   * Sets `isDraggingOutside` to true when the cursor leaves the today area.
   * Guards against unnecessary re-renders by skipping state updates when the value has not changed.
   *
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
    if (!activeData) return;

    const overData = over?.data.current as { type?: string } | undefined;
    const isOverTodayArea =
      over?.id === TODAY_DROP_ZONE_ID || overData?.type === "today-item";

    // Drag from TodoList → TodayTasksArea (empty or over an existing today-item)
    if (activeData.type === "todo-item" && over && isOverTodayArea) {
      void handleAddToToday(activeData.issueId);
      return;
    }

    // today-item drag: remove on drop-outside, reorder on drop-inside
    if (activeData.type === "today-item") {
      setIsDraggingOutside(false);

      if (!over || !isOverTodayArea) {
        // Dropped outside the today area — remove from today list
        void handleRemoveFromToday(activeData.issueId);
        return;
      }

      // Dropped inside today area — reorder
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

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      {/* Top nav bar — full width, matches mock's h-14 header */}
      <Box
        sx={{
          height: 56,
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography sx={{ fontWeight: 600, fontSize: "0.9rem", color: "text.primary" }}>
            {t("title")}
          </Typography>
        </Box>
        <SyncStatus providers={syncProviders} isSyncing={isSyncing} onSyncNow={handleSyncNow} />
      </Box>

      {/* Content area — max-width centered, generous vertical padding */}
      <Box sx={{ maxWidth: 896, mx: "auto", py: 5, px: 3 }}>
        <TodayTasksArea items={todayIssuesSorted} onRemove={handleRemoveFromToday} onComplete={handleComplete} />

        {/* Backlog section header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3, px: 0.5 }}>
          <Box
            sx={{
              p: 1,
              bgcolor: "#f1f5f9",
              borderRadius: "8px",
              color: "text.secondary",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <InboxIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "1.1rem", fontWeight: 700, color: "text.primary", letterSpacing: "-0.01em" }}>
              {t("backlog")}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ mb: 3 }}>
          <TaskSearchBar
            value={rawQuery}
            onSearch={setRawQuery}
            onClear={clearSearch}
            availableProviders={availableProviderTypes}
            availableProjects={availableProjectNames}
            hasNoResults={!loading && total === 0 && rawQuery.trim().length > 0}
          />
        </Box>
        <TodoList
          items={issues}
          total={total}
          page={page}
          limit={20}
          loading={loading}
          showCreatedAt={boardSettings.showCreatedAt}
          showUpdatedAt={boardSettings.showUpdatedAt}
          onPageChange={handlePageChange}
          onComplete={handleComplete}
          onAddToToday={handleAddToToday}
          onTogglePin={handleTogglePin}
        />
      </Box>

      <DragOverlay>
        {activeIssue ? (
          <Box
            sx={{
              cursor: "grabbing",
              boxShadow: 6,
              borderRadius: 1,
              ...(isDraggingOutside ? { filter: "grayscale(80%)", opacity: 0.6 } : { opacity: 0.95 }),
            }}
          >
            <IssueCard
              id={activeIssue.id}
              externalId={activeIssue.externalId}
              title={activeIssue.title}
              dueDate={activeIssue.dueDate}
              externalUrl={activeIssue.externalUrl}
              isUnassigned={activeIssue.isUnassigned}
              providerCreatedAt={activeIssue.providerCreatedAt}
              providerUpdatedAt={activeIssue.providerUpdatedAt}
              providerIconUrl={activeIssue.project.issueProvider.iconUrl}
              providerName={activeIssue.project.issueProvider.displayName}
              projectName={activeIssue.project.displayName}
              showCreatedAt={boardSettings.showCreatedAt}
              showUpdatedAt={boardSettings.showUpdatedAt}
              actionButton={null}
              dragContainerRef={undefined}
              dragHandleAttributes={undefined}
              dragHandleListeners={undefined}
            />
          </Box>
        ) : null}
      </DragOverlay>

      <CompleteIssueModal
        open={completeModalIssueId !== null}
        issueId={completeModalIssueId ?? ""}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      />
    </DndContext>
  );
}
