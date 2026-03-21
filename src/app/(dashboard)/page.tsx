"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Box, Container, Snackbar, Alert, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import TodoList from "@/components/todo/TodoList";
import SyncStatus from "@/components/todo/SyncStatus";
import TodayTasksArea, { TODAY_DROP_ZONE_ID } from "@/components/today-tasks/TodayTasksArea";
import { allProjectsSynced } from "@/lib/sync-utils";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type Status = "OPEN" | "CLOSED";

interface Issue {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  externalUrl: string;
  isUnassigned: boolean;
  todayFlag: boolean;
  todayOrder: number | null;
  todayAddedAt: string | null;
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

export default function DashboardPage() {
  const t = useTranslations("todo");
  const tToday = useTranslations("todayTasks");

  const [issues, setIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProviders, setSyncProviders] = useState<SyncProvider[]>([]);
  const [toast, setToast] = useState<Toast>({ open: false, message: "", severity: "success" });
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const syncStartedAtRef = useRef<Date | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  const todayIssues = issues
    .filter((i) => i.todayFlag && i.status === "OPEN")
    .map((i) => ({ ...i, todayOrder: i.todayOrder ?? 0 }));

  const regularIssues = issues.filter((i) => !i.todayFlag);

  function showToast(message: string, severity: ToastSeverity) {
    setToast({ open: true, message, severity });
  }

  const fetchIssues = useCallback(async (p: number) => {
    const res = await fetch(`/api/issues?page=${p}&limit=20`);
    if (res.ok) {
      const json = await res.json();
      setIssues((prev) => {
        const prevById = new Map(prev.map((i) => [i.id, i]));
        return json.data.items.map((fetched: Issue) => {
          const existing = prevById.get(fetched.id);
          // Preserve todayFlag from local state if it was optimistically set to true
          // but the fetch returned false (race condition: fetch ran before PATCH committed)
          if (existing && existing.todayFlag && !fetched.todayFlag) {
            return { ...fetched, todayFlag: existing.todayFlag, todayOrder: existing.todayOrder, todayAddedAt: existing.todayAddedAt };
          }
          return fetched;
        });
      });
      setTotal(json.data.total);
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

    async function poll() {
      if (cancelled) return;

      const syncRes = await fetch("/api/sync");
      if (!cancelled && syncRes.ok) {
        const json = await syncRes.json();
        const providers: SyncProvider[] = json.data;
        setSyncProviders(providers);

        const since = syncStartedAtRef.current;
        if (since && allProjectsSynced(providers, since)) {
          if (!cancelled) await fetchIssues(page);
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
  }, [isSyncing, page, fetchIssues]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([
        fetchIssues(1),
        fetch("/api/sync").then(async (res) => {
          if (res.ok) setSyncProviders((await res.json()).data);
        }),
      ]);
      setLoading(false);
      void startSync();
    }
    void init();
  }, [fetchIssues, startSync]);

  async function handlePageChange(newPage: number) {
    setPage(newPage);
    await fetchIssues(newPage);
  }

  async function handleStatusChange(id: string, newStatus: Status) {
    setIssues((prev) =>
      prev.map((issue) => (issue.id === id ? { ...issue, status: newStatus } : issue))
    );

    const res = await fetch(`/api/issues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!res.ok) {
      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === id
            ? { ...issue, status: newStatus === "CLOSED" ? "OPEN" : "CLOSED" }
            : issue
        )
      );
    }
  }

  async function handleAddToToday(id: string) {
    const maxOrder = todayIssues.reduce((max, i) => Math.max(max, i.todayOrder), 0);

    // Optimistic update
    setIssues((prev) =>
      prev.map((issue) =>
        issue.id === id
          ? { ...issue, todayFlag: true, todayOrder: maxOrder + 1, todayAddedAt: new Date().toISOString() }
          : issue
      )
    );

    const res = await fetch(`/api/issues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ todayFlag: true }),
    });

    if (res.ok) {
      const json = await res.json();
      setIssues((prev) =>
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
      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === id
            ? { ...issue, todayFlag: false, todayOrder: null, todayAddedAt: null }
            : issue
        )
      );
      showToast(tToday("addError"), "error");
    }
  }

  async function handleRemoveFromToday(id: string) {
    const issue = issues.find((i) => i.id === id);
    if (!issue) return;

    // Optimistic update
    setIssues((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, todayFlag: false, todayOrder: null, todayAddedAt: null } : i
      )
    );

    const res = await fetch(`/api/issues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ todayFlag: false }),
    });

    if (res.ok) {
      showToast(tToday("removeSuccess"), "success");
    } else {
      // Rollback
      setIssues((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, todayFlag: issue.todayFlag, todayOrder: issue.todayOrder, todayAddedAt: issue.todayAddedAt }
            : i
        )
      );
      showToast(tToday("removeError"), "error");
    }
  }

  async function handleReorder(orderedIds: string[]) {
    const prevIssues = issues;

    // Optimistic update: reassign todayOrder based on new positions
    setIssues((prev) =>
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
      setIssues(prevIssues);
      showToast(tToday("reorderError"), "error");
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const activeData = event.active.data.current as { type: string; issueId: string } | undefined;
    if (activeData?.type === "todo-item") {
      setActiveDragId(activeData.issueId);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);

    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as { type: string; issueId: string } | undefined;
    if (!activeData) return;

    const overData = over.data.current as { type?: string } | undefined;
    const isOverTodayArea = over.id === TODAY_DROP_ZONE_ID || overData?.type === "today-item";

    // Drag from TodoList → TodayTasksArea (empty or over an existing today-item)
    if (activeData.type === "todo-item" && isOverTodayArea) {
      void handleAddToToday(activeData.issueId);
      return;
    }

    // Reorder within TodayTasksArea
    if (activeData.type === "today-item" && active.id !== over.id) {
      if (isOverTodayArea) {
        const ids = todayIssues
          .sort((a, b) => a.todayOrder - b.todayOrder)
          .map((i) => i.id);
        const oldIndex = ids.indexOf(active.id as string);
        const newIndex = ids.indexOf(over.id as string);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = arrayMove(ids, oldIndex, newIndex);
          void handleReorder(reordered);
        }
      }
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("title")}
        </Typography>

        <SyncStatus providers={syncProviders} isSyncing={isSyncing} />

        <Box sx={{ mt: 2 }}>
          <TodayTasksArea items={todayIssues} onRemove={handleRemoveFromToday} onStatusChange={handleStatusChange} />
          <TodoList
            items={regularIssues}
            total={total - todayIssues.length}
            page={page}
            limit={20}
            loading={loading}
            onPageChange={handlePageChange}
            onStatusChange={handleStatusChange}
            onAddToToday={handleAddToToday}
          />
        </Box>
      </Container>

      <DragOverlay>
        {activeDragId ? (() => {
          const issue = issues.find((i) => i.id === activeDragId);
          if (!issue) return null;
          return (
            <Box
              sx={{
                bgcolor: "background.paper",
                border: 1,
                borderColor: "primary.main",
                borderRadius: 1,
                px: 2,
                py: 1,
                boxShadow: 4,
                opacity: 0.9,
                cursor: "grabbing",
              }}
            >
              <Typography variant="body1" noWrap>
                {issue.title}
              </Typography>
            </Box>
          );
        })() : null}
      </DragOverlay>

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
