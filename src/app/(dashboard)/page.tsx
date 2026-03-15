"use client";

import { useState, useEffect, useCallback } from "react";
import { Box, Container, Typography } from "@mui/material";
import { useTranslations } from "next-intl";
import TodoList from "@/components/todo/TodoList";
import SyncStatus from "@/components/todo/SyncStatus";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type Status = "OPEN" | "CLOSED";

interface Issue {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  externalUrl: string;
  project: {
    displayName: string;
    issueProvider: { type: string; displayName: string };
  };
}

interface SyncProvider {
  id: string;
  displayName: string;
  type: string;
  projects: { id: string; displayName: string; lastSyncedAt: string | null }[];
}

export default function DashboardPage() {
  const t = useTranslations("todo");

  const [issues, setIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProviders, setSyncProviders] = useState<SyncProvider[]>([]);

  const fetchIssues = useCallback(async (p: number) => {
    const res = await fetch(`/api/issues?page=${p}&limit=20`);
    if (res.ok) {
      const json = await res.json();
      setIssues(json.data.items);
      setTotal(json.data.total);
    }
  }, []);

  const fetchSyncStatus = useCallback(async () => {
    const res = await fetch("/api/sync");
    if (res.ok) {
      const json = await res.json();
      setSyncProviders(json.data);
    }
  }, []);

  const startSync = useCallback(async () => {
    setIsSyncing(true);
    await fetch("/api/sync", { method: "POST" });
  }, []);

  // Poll sync status every 5s while syncing; cleans up on unmount or when syncing stops
  useEffect(() => {
    if (!isSyncing) return;

    const poll = setInterval(async () => {
      await fetchSyncStatus();
      const res = await fetch(`/api/issues?page=${page}&limit=20`);
      if (res.ok) {
        const json = await res.json();
        setIssues(json.data.items);
        setTotal(json.data.total);
      }
    }, 5000);

    // Stop polling after 2 minutes
    const timeout = setTimeout(() => {
      setIsSyncing(false);
    }, 120000);

    return () => {
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, [isSyncing, fetchSyncStatus, page]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchIssues(1), fetchSyncStatus()]);
      setLoading(false);
      startSync();
    }
    init();
  }, [fetchIssues, fetchSyncStatus, startSync]);

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
