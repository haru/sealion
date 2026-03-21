"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Box, Container, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import TodoList from "@/components/todo/TodoList";
import SyncStatus from "@/components/todo/SyncStatus";
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

export default function DashboardPage() {
  const t = useTranslations("todo");

  const [issues, setIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProviders, setSyncProviders] = useState<SyncProvider[]>([]);
  const syncStartedAtRef = useRef<Date | null>(null);

  const fetchIssues = useCallback(async (p: number) => {
    const res = await fetch(`/api/issues?page=${p}&limit=20`);
    if (res.ok) {
      const json = await res.json();
      setIssues(json.data.items);
      setTotal(json.data.total);
    }
  }, []);

  const startSync = useCallback(async () => {
    syncStartedAtRef.current = new Date();
    setIsSyncing(true);
    await fetch("/api/sync", { method: "POST" });
  }, []);

  // Poll sync status every 5s while syncing; stops when all enabled projects are synced.
  // Uses self-scheduling setTimeout to avoid overlapping requests.
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
        await fetchIssues(page);
      }

      if (!cancelled) {
        pollTimeout = setTimeout(poll, 5000);
      }
    }

    pollTimeout = setTimeout(poll, 5000);

    // Safety timeout: stop polling after 2 minutes
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
      await Promise.all([fetchIssues(1), fetch("/api/sync").then(async (res) => {
        if (res.ok) setSyncProviders((await res.json()).data);
      })]);
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
    // Optimistic update
    setIssues((prev) =>
      prev.map((issue) => (issue.id === id ? { ...issue, status: newStatus } : issue))
    );

    const res = await fetch(`/api/issues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!res.ok) {
      // Revert optimistic update
      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === id
            ? { ...issue, status: newStatus === "CLOSED" ? "OPEN" : "CLOSED" }
            : issue
        )
      );
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {t("title")}
      </Typography>

      <SyncStatus providers={syncProviders} isSyncing={isSyncing} />

      <Box sx={{ mt: 2 }}>
        <TodoList
          items={issues}
          total={total}
          page={page}
          limit={20}
          loading={loading}
          onPageChange={handlePageChange}
          onStatusChange={handleStatusChange}
        />
      </Box>
    </Container>
  );
}
