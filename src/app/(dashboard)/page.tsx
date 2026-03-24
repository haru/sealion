"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Box, Container, Snackbar, Alert, Typography } from "@mui/material";
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
import { allProjectsSynced, shouldThrottleSync, SYNC_THROTTLE_MS } from "@/lib/sync-utils";
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

type ToastSeverity = "success" | "error";
interface Toast {
  open: boolean;
  message: string;
  severity: ToastSeverity;
}

/** Main dashboard page showing today's tasks and the full issue list with drag-and-drop support. */
export default function DashboardPage() {
  const t = useTranslations("todo");
  const tToday = useTranslations("todayTasks");

  const [issues, setIssues] = useState<Issue[]>([]);
  const [todayIssues, setTodayIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProviders, setSyncProviders] = useState<SyncProvider[]>([]);
  const [toast, setToast] = useState<Toast>({ open: false, message: "", severity: "success" });
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isDraggingOutside, setIsDraggingOutside] = useState(false);
  const [completeModalIssueId, setCompleteModalIssueId] = useState<string | null>(null);
  const syncStartedAtRef = useRef<Date | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

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

  /** Shows a toast notification with the given message and severity. */
  function showToast(message: string, severity: ToastSeverity) {
    setToast({ open: true, message, severity });
  }

  const fetchIssues = useCallback(async (p: number) => {
    const res = await fetch(`/api/issues?page=${p}&limit=20`);
    if (res.ok) {
      const json = await res.json();
      setIssues(json.data.items);
      setTotal(json.data.total);
    }
  }, []);

  const fetchTodayIssues = useCallback(async () => {
    const res = await fetch("/api/issues/today");
    if (res.ok) {
      const json = await res.json();
      setTodayIssues(json.data.items);
    }
  }, []);

  const startSync = useCallback(async () => {
    syncStartedAtRef.current = new Date();
    setIsSyncing(true);
    await fetch("/api/sync", { method: "POST" });
  }, []);

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
        if (since && allProjectsSynced(providers, since)) {
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
      await Promise.all([
        fetchIssues(1),
        fetchTodayIssues(),
        fetch("/api/sync").then(async (res) => {
          if (res.ok) {
            fetchedProviders = (await res.json()).data;
            setSyncProviders(fetchedProviders);
          }
        }),
      ]);
      setLoading(false);
      if (!shouldThrottleSync(fetchedProviders, SYNC_THROTTLE_MS)) {
        void startSync();
      }
    }
    void init();
  }, [fetchIssues, fetchTodayIssues, startSync]);

  /** Fetches the requested page of issues. */
  async function handlePageChange(newPage: number) {
    setPage(newPage);
    await fetchIssues(newPage);
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
      showToast(tToday("addSuccess"), "success");
    } else {
      // Rollback
      setTodayIssues((prev) => prev.filter((i) => i.id !== id));
      setIssues((prev) => [...prev, issueToAdd]);
      showToast(tToday("addError"), "error");
    }
  }

  /** Optimistically removes an issue from today's list and clears the flag via the API. */
  async function handleRemoveFromToday(id: string) {
    const issue = todayIssues.find((i) => i.id === id);
    if (!issue) return;

    // Optimistic update: remove from today
    setTodayIssues((prev) => prev.filter((i) => i.id !== id));

    const res = await fetch(`/api/issues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ todayFlag: false }),
    });

    if (res.ok) {
      // Refetch regular issues so the item appears back in the list
      await fetchIssues(page);
      showToast(tToday("removeSuccess"), "success");
    } else {
      // Rollback
      setTodayIssues((prev) => [...prev, issue]);
      showToast(tToday("removeError"), "error");
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

    const res = await fetch("/api/issues/today/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });

    if (!res.ok) {
      setTodayIssues(prevTodayIssues);
      showToast(tToday("reorderError"), "error");
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
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("title")}
        </Typography>

        <SyncStatus providers={syncProviders} isSyncing={isSyncing} onSyncNow={handleSyncNow} />

        <Box sx={{ mt: 2 }}>
          <TodayTasksArea items={todayIssuesSorted} onRemove={handleRemoveFromToday} onComplete={handleComplete} />
          <TodoList
            items={issues}
            total={total}
            page={page}
            limit={20}
            loading={loading}
            onPageChange={handlePageChange}
            onComplete={handleComplete}
            onAddToToday={handleAddToToday}
          />
        </Box>
      </Container>

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

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </DndContext>
  );
}
