"use client";

import { useState, useEffect, useCallback } from "react";
import { parseSearchQuery, type ParsedQuery, type DateFilter } from "@/lib/search-parser";

/** Filter state for all available filter dimensions. */
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
  /** Active filter state managed separately from text input. */
  filters: TaskFilterState;
  /** Updates the raw search text. */
  setRawQuery: (value: string) => void;
  /**
   * Sets or clears a single filter field.
   * Pass `undefined` as value to clear that filter.
   * @param key - The filter field name.
   * @param value - The new value, or undefined to clear.
   */
  setFilter: (key: keyof TaskFilterState, value: TaskFilterState[keyof TaskFilterState]) => void;
  /** Clears the raw query text. */
  clearSearch: () => void;
  /** Clears all active filters. */
  clearAllFilters: () => void;
  /** Debounced (300ms) merged query used for API requests. */
  debouncedQuery: ParsedQuery;
}

const EMPTY_PARSED: ParsedQuery = { keywords: [] };
const DEBOUNCE_MS = 300;

/**
 * Merges parsed text keywords with separately managed filter state into a single {@link ParsedQuery}.
 * @param parsed - The result of parsing the raw text query.
 * @param filters - The active filter state.
 * @returns A merged {@link ParsedQuery}.
 */
function mergeQuery(parsed: ParsedQuery, filters: TaskFilterState): ParsedQuery {
  return {
    keywords: parsed.keywords,
    provider: filters.provider ?? parsed.provider,
    project: filters.project ?? parsed.project,
    dueDateFilter: filters.dueDateFilter ?? parsed.dueDateFilter,
    createdFilter: filters.createdFilter ?? parsed.createdFilter,
    updatedFilter: filters.updatedFilter ?? parsed.updatedFilter,
    assignee: filters.assignee ?? parsed.assignee,
  };
}

/**
 * Manages task search state including raw text input, parsed query, filter state, and debouncing.
 * The 300ms debounce prevents excessive API calls while the user types.
 * @returns {@link TaskSearchState}
 */
export function useTaskSearch(): TaskSearchState {
  const [rawQuery, setRawQueryState] = useState("");
  const [filters, setFiltersState] = useState<TaskFilterState>({});
  const [debouncedQuery, setDebouncedQuery] = useState<ParsedQuery>(EMPTY_PARSED);

  const parsedQuery = rawQuery.trim() ? parseSearchQuery(rawQuery) : EMPTY_PARSED;

  // Debounce: update debouncedQuery 300ms after rawQuery or filters change
  useEffect(() => {
    const merged = mergeQuery(parsedQuery, filters);
    const timer = setTimeout(() => {
      setDebouncedQuery(merged);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // parsedQuery is derived from rawQuery; include rawQuery and filters as deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawQuery, filters]);

  const setRawQuery = useCallback((value: string) => {
    setRawQueryState(value);
  }, []);

  const setFilter = useCallback(
    (key: keyof TaskFilterState, value: TaskFilterState[keyof TaskFilterState]) => {
      setFiltersState((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const clearSearch = useCallback(() => {
    setRawQueryState("");
  }, []);

  const clearAllFilters = useCallback(() => {
    setFiltersState({});
  }, []);

  return {
    rawQuery,
    parsedQuery,
    filters,
    setRawQuery,
    setFilter,
    clearSearch,
    clearAllFilters,
    debouncedQuery,
  };
}
