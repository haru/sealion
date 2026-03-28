/**
 * Unit tests for the useTaskSearch hook.
 * Tests cover: initial state, setRawQuery, clearSearch, debounce behaviour,
 * and query output (all filters flow through rawQuery text).
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
  it("starts with empty rawQuery and empty debouncedQuery", () => {
    const { result } = renderHook(() => useTaskSearch());
    expect(result.current.rawQuery).toBe("");
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

  it("parses inline filter tokens from rawQuery", async () => {
    const { result } = renderHook(() => useTaskSearch());

    act(() => {
      result.current.setRawQuery("provider:GITHUB assignee:unassigned");
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.debouncedQuery.provider).toBe("GITHUB");
      expect(result.current.debouncedQuery.assignee).toBe("unassigned");
      expect(result.current.debouncedQuery.keywords).toEqual([]);
    });
  });
});

describe("useTaskSearch — clearSearch", () => {
  it("resets rawQuery to empty string", () => {
    const { result } = renderHook(() => useTaskSearch());
    act(() => {
      result.current.setRawQuery("some query provider:JIRA");
    });
    act(() => {
      result.current.clearSearch();
    });
    expect(result.current.rawQuery).toBe("");
  });
});
