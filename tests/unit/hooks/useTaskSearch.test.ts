/**
 * Unit tests for the useTaskSearch hook.
 * Tests cover: initial state, setRawQuery, setFilter, clearSearch, clearAllFilters,
 * debounce behaviour, and merged query output.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useTaskSearch } from "@/hooks/useTaskSearch";

// Speed up debounce tests by using fake timers
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe("useTaskSearch — initial state", () => {
  it("starts with empty rawQuery and empty filters", () => {
    const { result } = renderHook(() => useTaskSearch());
    expect(result.current.rawQuery).toBe("");
    expect(result.current.filters).toEqual({});
    expect(result.current.parsedQuery).toEqual({ keywords: [] });
    expect(result.current.debouncedQuery).toEqual({ keywords: [] });
  });
});

describe("useTaskSearch — setRawQuery", () => {
  it("updates rawQuery and parsedQuery immediately", () => {
    const { result } = renderHook(() => useTaskSearch());
    act(() => {
      result.current.setRawQuery("fix login");
    });
    expect(result.current.rawQuery).toBe("fix login");
    expect(result.current.parsedQuery.keywords).toEqual(["fix", "login"]);
  });

  it("debounces debouncedQuery by 300ms", async () => {
    const { result } = renderHook(() => useTaskSearch());

    act(() => {
      result.current.setRawQuery("bug");
    });

    // Before debounce fires, debouncedQuery is still empty
    expect(result.current.debouncedQuery.keywords).toEqual([]);

    // Advance timers by 300ms
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.debouncedQuery.keywords).toEqual(["bug"]);
    });
  });

  it("resets debounce timer when rawQuery changes rapidly", async () => {
    const { result } = renderHook(() => useTaskSearch());

    act(() => {
      result.current.setRawQuery("bu");
    });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    act(() => {
      result.current.setRawQuery("bug");
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.debouncedQuery.keywords).toEqual(["bug"]);
    });
  });
});

describe("useTaskSearch — setFilter", () => {
  it("sets a provider filter", () => {
    const { result } = renderHook(() => useTaskSearch());
    act(() => {
      result.current.setFilter("provider", "GITHUB");
    });
    expect(result.current.filters.provider).toBe("GITHUB");
  });

  it("sets an assignee filter", () => {
    const { result } = renderHook(() => useTaskSearch());
    act(() => {
      result.current.setFilter("assignee", "unassigned");
    });
    expect(result.current.filters.assignee).toBe("unassigned");
  });

  it("clears a filter when set to undefined", () => {
    const { result } = renderHook(() => useTaskSearch());
    act(() => {
      result.current.setFilter("provider", "GITHUB");
    });
    act(() => {
      result.current.setFilter("provider", undefined);
    });
    expect(result.current.filters.provider).toBeUndefined();
  });

  it("merges filters into debouncedQuery after debounce", async () => {
    const { result } = renderHook(() => useTaskSearch());

    act(() => {
      result.current.setFilter("provider", "JIRA");
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.debouncedQuery.provider).toBe("JIRA");
    });
  });
});

describe("useTaskSearch — clearSearch", () => {
  it("resets rawQuery to empty string", () => {
    const { result } = renderHook(() => useTaskSearch());
    act(() => {
      result.current.setRawQuery("some query");
    });
    act(() => {
      result.current.clearSearch();
    });
    expect(result.current.rawQuery).toBe("");
  });
});

describe("useTaskSearch — clearAllFilters", () => {
  it("resets all filters to empty object", () => {
    const { result } = renderHook(() => useTaskSearch());
    act(() => {
      result.current.setFilter("provider", "GITHUB");
      result.current.setFilter("assignee", "assigned");
    });
    act(() => {
      result.current.clearAllFilters();
    });
    expect(result.current.filters).toEqual({});
  });
});

describe("useTaskSearch — merged debouncedQuery", () => {
  it("includes both keywords and filter fields in debouncedQuery", async () => {
    const { result } = renderHook(() => useTaskSearch());

    act(() => {
      result.current.setRawQuery("bug");
      result.current.setFilter("provider", "GITHUB");
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.debouncedQuery.keywords).toEqual(["bug"]);
      expect(result.current.debouncedQuery.provider).toBe("GITHUB");
    });
  });

  it("filter state overrides text-parsed provider in merged query", async () => {
    const { result } = renderHook(() => useTaskSearch());

    // Text input sets a provider via prefix token
    act(() => {
      result.current.setRawQuery("provider:JIRA");
      // Separately set a filter
      result.current.setFilter("provider", "GITHUB");
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      // Filter state takes precedence over parsed text token
      expect(result.current.debouncedQuery.provider).toBe("GITHUB");
    });
  });
});
