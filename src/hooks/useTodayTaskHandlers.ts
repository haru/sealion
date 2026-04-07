"use client";

import { useCallback, useState } from "react";

import { sortIssues } from "@/lib/search/sort-utils";
import type { SortCriterion } from "@/lib/types";
import type { ClientIssue } from "@/types/issue";

/** Options for {@link useTodayTaskHandlers}. */
interface UseTodayTaskHandlersOptions {
  /** Current list of regular issues. */
  issues: ClientIssue[];
  /** Current list of today's issues. */
  todayIssues: ClientIssue[];
  /** Sets the issue list state. */
  setIssues: React.Dispatch<React.SetStateAction<ClientIssue[]>>;
  /** Sets the today issues state. */
  setTodayIssues: React.Dispatch<React.SetStateAction<ClientIssue[]>>;
  /** Ref holding the current board sort order. */
  boardSettingsSortOrderRef: React.RefObject<SortCriterion[]>;
  /** Message queue add function for notifications. */
  addMessage: (type: "information" | "warning" | "error", msg: string) => void;
  /** Current page number for refetching after removing from today. */
  page: number;
  /** Fetches a page of issues. */
  fetchIssues: (page: number) => Promise<void>;
  /** Translation function for todo namespace. */
  t: (key: string) => string;
  /** Translation function for todayTasks namespace. */
  tToday: (key: string) => string;
}

/** Return value of {@link useTodayTaskHandlers}. */
interface UseTodayTaskHandlersResult {
  /** ID of the issue currently shown in the complete modal, or `null`. */
  completeModalIssueId: string | null;
  /** Closes the complete-issue modal. */
  handleModalCancel: () => void;
  /** Confirms issue close from the modal.
   * @param issueId - Internal ID of the issue to close.
   * @param comment - Optional completion reason entered by the user.
   */
  handleModalConfirm: (issueId: string, comment: string) => Promise<void>;
  /** Opens the complete-issue modal for the given issue ID. */
  handleComplete: (id: string) => void;
  /** Optimistically adds an issue to today's list. */
  handleAddToToday: (id: string) => Promise<void>;
  /** Optimistically removes an issue from today's list. */
  handleRemoveFromToday: (id: string) => Promise<void>;
  /** Optimistically reorders today's issues. */
  handleReorder: (orderedIds: string[]) => Promise<void>;
  /** Optimistically toggles the pinned state of an issue.
   * @param id - Internal issue ID.
   * @param pinned - The new pinned state to apply.
   */
  handleTogglePin: (id: string, pinned: boolean) => Promise<void>;
}

/**
 * Provides handlers for today task actions: complete, add, remove, reorder, and pin toggle.
 * All operations are optimistic with rollback on API failure.
 * @param options - State, refs, and callbacks required by the handlers.
 * @returns Today task action handlers and modal state.
 */
export function useTodayTaskHandlers({
  issues,
  todayIssues,
  setIssues,
  setTodayIssues,
  boardSettingsSortOrderRef,
  addMessage,
  page,
  fetchIssues,
  t,
  tToday,
}: UseTodayTaskHandlersOptions): UseTodayTaskHandlersResult {
  const [completeModalIssueId, setCompleteModalIssueId] = useState<string | null>(null);

  const handleTogglePin = useCallback(async (id: string, pinned: boolean) => {
    const original = issues.find((i) => i.id === id);
    if (!original) { return; }

    const rollback = () => {
      setIssues((prev) =>
        sortIssues(
          prev.map((i) => (i.id === id ? { ...i, pinned: original.pinned } : i)),
          boardSettingsSortOrderRef.current,
        ),
      );
      addMessage("error", t("pinToggleError"));
    };

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
      if (!res.ok) { rollback(); }
    } catch {
      rollback();
    }
  }, [issues, setIssues, boardSettingsSortOrderRef, addMessage, t]);

  const handleComplete = useCallback((id: string) => {
    setCompleteModalIssueId(id);
  }, []);

  const handleModalCancel = useCallback(() => {
    setCompleteModalIssueId(null);
  }, []);

  const handleModalConfirm = useCallback(async (issueId: string, comment: string) => {
    const originalInToday = todayIssues.find((i) => i.id === issueId);
    const originalInIssues = issues.find((i) => i.id === issueId);

    if (originalInToday) {
      setTodayIssues((prev) => prev.filter((i) => i.id !== issueId));
    }
    setIssues((prev) => prev.filter((issue) => issue.id !== issueId));

    const body: Record<string, unknown> = { closed: true };
    if (comment.trim()) { body.comment = comment.trim(); }

    try {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
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
  }, [todayIssues, issues, setTodayIssues, setIssues]);

  const handleAddToToday = useCallback(async (id: string) => {
    const issueToAdd = issues.find((i) => i.id === id);
    if (!issueToAdd) { return; }

    const maxOrder = todayIssues.reduce((max, i) => Math.max(max, i.todayOrder ?? 0), 0);
    const optimisticItem = {
      ...issueToAdd,
      todayFlag: true,
      todayOrder: maxOrder + 1,
      todayAddedAt: new Date().toISOString(),
    };

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
          ),
        );
        addMessage("information", tToday("addSuccess"));
      } else {
        setTodayIssues((prev) => prev.filter((i) => i.id !== id));
        setIssues((prev) => [...prev, issueToAdd]);
        addMessage("error", tToday("addError"));
      }
    } catch {
      setTodayIssues((prev) => prev.filter((i) => i.id !== id));
      setIssues((prev) => [...prev, issueToAdd]);
      addMessage("error", tToday("addError"));
    }
  }, [issues, todayIssues, setIssues, setTodayIssues, addMessage, tToday]);

  const handleRemoveFromToday = useCallback(async (id: string) => {
    const issue = todayIssues.find((i) => i.id === id);
    if (!issue) { return; }

    setTodayIssues((prev) => prev.filter((i) => i.id !== id));

    try {
      const res = await fetch(`/api/issues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todayFlag: false }),
      });

      if (res.ok) {
        await fetchIssues(page);
        addMessage("information", tToday("removeSuccess"));
      } else {
        setTodayIssues((prev) => [...prev, issue]);
        addMessage("error", tToday("removeError"));
      }
    } catch {
      setTodayIssues((prev) => [...prev, issue]);
      addMessage("error", tToday("removeError"));
    }
  }, [todayIssues, setTodayIssues, page, fetchIssues, addMessage, tToday]);

  const handleReorder = useCallback(async (orderedIds: string[]) => {
    const prevTodayIssues = todayIssues;

    setTodayIssues((prev) =>
      prev.map((issue) => {
        const newOrder = orderedIds.indexOf(issue.id);
        if (newOrder === -1) { return issue; }
        return { ...issue, todayOrder: newOrder + 1 };
      }),
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
  }, [todayIssues, setTodayIssues, addMessage, tToday]);

  return {
    completeModalIssueId,
    handleModalCancel,
    handleModalConfirm,
    handleComplete,
    handleAddToToday,
    handleRemoveFromToday,
    handleReorder,
    handleTogglePin,
  };
}
