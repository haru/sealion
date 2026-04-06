"use client";

import { useCallback, useState } from "react";

import { serializeKeywords } from "@/lib/search/search-parser";
import type { ParsedQuery } from "@/lib/search/search-parser";
import type { SortCriterion } from "@/lib/types";
import type { ClientIssue } from "@/types/issue";

/** Options for {@link useIssueData}. */
interface UseIssueDataOptions {
  /** Debounced parsed query from {@link useTaskSearch}. */
  debouncedQuery: ParsedQuery;
  /** Ref holding the current board sort order, used as default when no explicit order is provided. */
  boardSettingsSortOrderRef: React.RefObject<SortCriterion[]>;
}

/** Return value of {@link useIssueData}. */
interface UseIssueDataResult {
  /** Current list of issues. */
  issues: ClientIssue[];
  /** Current list of today's issues. */
  todayIssues: ClientIssue[];
  /** Total number of issues matching the current query. */
  total: number;
  /** Current page number (1-based). */
  page: number;
  /** Whether the initial data load is in progress. */
  loading: boolean;
  /** Sets the issue list state. */
  setIssues: React.Dispatch<React.SetStateAction<ClientIssue[]>>;
  /** Sets the today issues state. */
  setTodayIssues: React.Dispatch<React.SetStateAction<ClientIssue[]>>;
  /** Sets the loading state. */
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  /** Sets the current page number. */
  setPage: React.Dispatch<React.SetStateAction<number>>;
  /**
   * Fetches a page of issues from the API.
   * @param p - Page number (1-based).
   * @param sortOrder - Explicit sort order; defaults to `boardSettingsSortOrderRef.current`.
   * @param searchQuery - Parsed search query; defaults to the hook's `debouncedQuery`.
   */
  fetchIssues: (p: number, sortOrder?: SortCriterion[], searchQuery?: ParsedQuery) => Promise<void>;
  /** Fetches today's issues from the API. */
  fetchTodayIssues: () => Promise<void>;
  /** Changes the current page and fetches the corresponding issues.
   * @param newPage - The new page number.
   */
  handlePageChange: (newPage: number) => Promise<void>;
}

/**
 * Manages issue list state and API fetching for the dashboard.
 * @param options - Configuration including the debounced search query and sort order ref.
 * @returns Issue data, fetch functions, and page change handler.
 */
export function useIssueData({ debouncedQuery, boardSettingsSortOrderRef }: UseIssueDataOptions): UseIssueDataResult {
  const [issues, setIssues] = useState<ClientIssue[]>([]);
  const [todayIssues, setTodayIssues] = useState<ClientIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchIssues = useCallback(
    async (p: number, sortOrder?: SortCriterion[], searchQuery?: ParsedQuery) => {
      const order = sortOrder ?? boardSettingsSortOrderRef.current;
      const q = searchQuery ?? debouncedQuery;

      const params = new URLSearchParams({
        page: String(p),
        limit: "20",
        sortOrder: order.join(","),
      });

      if (q.keywords.length > 0) { params.set("q", serializeKeywords(q.keywords)); }
      if (q.provider) { params.set("provider", q.provider); }
      if (q.project) { params.set("project", q.project); }
      if (q.dueDateFilter) { params.set("dueDateRange", q.dueDateFilter.preset); }
      if (q.createdFilter) { params.set("createdRange", q.createdFilter.preset); }
      if (q.updatedFilter) { params.set("updatedRange", q.updatedFilter.preset); }
      if (q.assignee) { params.set("assignee", q.assignee); }

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
    [debouncedQuery, boardSettingsSortOrderRef],
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

  /** Fetches the requested page of issues and updates the current page state. */
  async function handlePageChange(newPage: number) {
    setPage(newPage);
    await fetchIssues(newPage);
  }

  return {
    issues,
    todayIssues,
    total,
    page,
    loading,
    setIssues,
    setTodayIssues,
    setLoading,
    setPage,
    fetchIssues,
    fetchTodayIssues,
    handlePageChange,
  };
}
