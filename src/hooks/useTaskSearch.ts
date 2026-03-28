"use client";

import { useState, useEffect, useCallback } from "react";
import { parseSearchQuery, type ParsedQuery, type DateFilter } from "@/lib/search-parser";

/**
 * Filter state shape used by the search UI components.
 * All filter values flow through the raw query text and are extracted by {@link parseSearchQuery}.
 */
export interface TaskFilterState {
  /** Provider type filter (e.g. "GITHUB"). */
  provider?: string;
  /** Project display name filter. */
  project?: string;
  /** Due date range filter. */
  dueDateFilter?: DateFilter;
  /** Created date range filter. */
  createdFilter?: DateFilter;
  /** Updated date range filter. */
  updatedFilter?: DateFilter;
  /** Assignee filter. */
  assignee?: "unassigned" | "assigned";
}

/** The value returned by the {@link useTaskSearch} hook. */
export interface TaskSearchState {
  /** Current raw text in the search input. */
  rawQuery: string;
  /** Parsed result of rawQuery (parsed immediately, not debounced). */
  parsedQuery: ParsedQuery;
  /** Updates the raw search text. */
  setRawQuery: (value: string) => void;
  /** Clears the raw query text. */
  clearSearch: () => void;
  /** Debounced (300ms) parsed query used for API requests. */
  debouncedQuery: ParsedQuery;
}

const EMPTY_PARSED: ParsedQuery = { keywords: [] };
const DEBOUNCE_MS = 300;

/**
 * Manages task search state: raw text input, parsed query, and debouncing.
 * All filters (provider, project, dueDate, etc.) are embedded as `key:value` tokens
 * in the raw query text and extracted by {@link parseSearchQuery}.
 * The 300ms debounce prevents excessive API calls while the user types.
 * @returns {@link TaskSearchState}
 */
export function useTaskSearch(): TaskSearchState {
  const [rawQuery, setRawQueryState] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState<ParsedQuery>(EMPTY_PARSED);

  const parsedQuery = rawQuery.trim() ? parseSearchQuery(rawQuery) : EMPTY_PARSED;

  // Debounce: update debouncedQuery 300ms after rawQuery changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(rawQuery.trim() ? parseSearchQuery(rawQuery) : EMPTY_PARSED);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const setRawQuery = useCallback((value: string) => {
    setRawQueryState(value);
  }, []);

  const clearSearch = useCallback(() => {
    setRawQueryState("");
  }, []);

  return {
    rawQuery,
    parsedQuery,
    setRawQuery,
    clearSearch,
    debouncedQuery,
  };
}
