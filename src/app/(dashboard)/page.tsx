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
import type { Priority, Status } from "@/lib/types";

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
  const [todayIssues, setTodayIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProviders, setSyncProviders] = useState<SyncProvider[]>([]);
  const [toast, setToast] = useState<Toast>({ open: false, message: "", severity: "success" });
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const syncStartedAtRef = useRef<Date | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  const todayIssuesSorted = todayIssues
    .map((i) => ({ ...i, todayOrder: i.todayOrder ?? 0 }))
    .sort((a, b) => a.todayOrder - b.todayOrder);

  const regularIssues = issues;

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

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([
        fetchIssues(1),
        fetchTodayIssues(),
        fetch("/api/sync").then(async (res) => {
          if (res.ok) setSyncProviders((await res.json()).data);
        }),
      ]);
      setLoading(false);
      void startSync();
    }
    void init();
  }, [fetchIssues, fetchTodayIssues, startSync]);

  async function handlePageChange(newPage: number) {
    setPage(newPage);
    await fetchIssues(newPage);
  }

  async function handleStatusChange(id: string, newStatus: Status) {
    const originalInToday = todayIssues.find((i) => i.id === id);
    const originalInRegular = issues.find((i) => i.id === id);

    // Optimistic update: if closing a today item, remove it from today list
    if (originalInToday && newStatus === "CLOSED") {
      setTodayIssues((prev) => prev.filter((i) => i.id !== id));
    } else if (originalInToday) {
      setTodayIssues((prev) =>
        prev.map((issue) => (issue.id === id ? { ...issue, status: newStatus } : issue))
      );
    } else {
      setIssues((prev) =>
        prev.map((issue) => (issue.id === id ? { ...issue, status: newStatus } : issue))
      );
    }

    const res = await fetch(`/api/issues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!res.ok) {
      if (originalInToday) {
        setTodayIssues((prev) => {
          const exists = prev.some((i) => i.id === id);
          return exists
            ? prev.map((i) => (i.id === id ? originalInToday : i))
            : [...prev, originalInToday];
        });
      }
      if (originalInRegular) {
        setIssues((prev) =>
          prev.map((issue) => (issue.id === id ? originalInRegular : issue))
        );
      }
      showToast(t("statusChangeError"), "error");
    }
  }

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
        const ids = todayIssuesSorted.map((i) => i.id);
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
          <TodayTasksArea items={todayIssuesSorted} onRemove={handleRemoveFromToday} onStatusChange={handleStatusChange} />
          <TodoList
            items={regularIssues}
            total={total}
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
          const issue = [...issues, ...todayIssues].find((i) => i.id === activeDragId);
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
