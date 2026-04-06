/** @jest-environment jsdom */
import { act, renderHook } from "@testing-library/react";

import { useIssueData } from "@/hooks/useIssueData";
import type { ClientIssue } from "@/types/issue";

const MOCK_ISSUE: ClientIssue = {
  id: "1",
  externalId: "42",
  title: "Fix bug",
  dueDate: null,
  externalUrl: "https://example.com/42",
  isUnassigned: true,
  todayFlag: false,
  todayOrder: null,
  todayAddedAt: null,
  providerCreatedAt: "2025-01-01T00:00:00Z",
  providerUpdatedAt: null,
  pinned: false,
  project: {
    displayName: "repo",
    issueProvider: { iconUrl: null, displayName: "GitHub" },
  },
};

const DEFAULT_SORT = ["dueDate", "providerCreatedAt"];

function makeRef<T>(value: T): React.RefObject<T> {
  return { current: value };
}

describe("useIssueData", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns initial state with loading=true", () => {
    const { result } = renderHook(() =>
      useIssueData({
        debouncedQuery: { keywords: [] },
        boardSettingsSortOrderRef: makeRef(DEFAULT_SORT as any),
      }),
    );
    expect(result.current.loading).toBe(true);
    expect(result.current.issues).toEqual([]);
    expect(result.current.todayIssues).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.page).toBe(1);
  });

  describe("fetchIssues", () => {
    it("fetches issues and updates state on success", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { items: [MOCK_ISSUE], total: 1 },
        }),
      });

      const { result } = renderHook(() =>
        useIssueData({
          debouncedQuery: { keywords: [] },
          boardSettingsSortOrderRef: makeRef(DEFAULT_SORT as any),
        }),
      );

      await act(async () => {
        await result.current.fetchIssues(1);
      });

      expect(result.current.issues).toEqual([MOCK_ISSUE]);
      expect(result.current.total).toBe(1);
    });

    it("passes search query parameters to the API", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ data: { items: [], total: 0 } }),
      });

      const { result } = renderHook(() =>
        useIssueData({
          debouncedQuery: {
            keywords: ["bug"],
            provider: "GITHUB",
            project: "repo",
            dueDateFilter: { preset: "today" as any },
            createdFilter: { preset: "past7days" as any },
            updatedFilter: { preset: "past30days" as any },
            assignee: "unassigned",
          },
          boardSettingsSortOrderRef: makeRef(DEFAULT_SORT as any),
        }),
      );

      await act(async () => {
        await result.current.fetchIssues(1);
      });

      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain("q=bug");
      expect(calledUrl).toContain("provider=GITHUB");
      expect(calledUrl).toContain("project=repo");
      expect(calledUrl).toContain("dueDateRange=today");
      expect(calledUrl).toContain("createdRange=past7days");
      expect(calledUrl).toContain("updatedRange=past30days");
      expect(calledUrl).toContain("assignee=unassigned");
    });

    it("uses explicit sortOrder when provided", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ data: { items: [], total: 0 } }),
      });

      const { result } = renderHook(() =>
        useIssueData({
          debouncedQuery: { keywords: [] },
          boardSettingsSortOrderRef: makeRef(DEFAULT_SORT as any),
        }),
      );

      await act(async () => {
        await result.current.fetchIssues(1, ["providerCreatedAt"] as any);
      });

      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain("sortOrder=providerCreatedAt");
    });

    it("does not update state when response is not ok", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() =>
        useIssueData({
          debouncedQuery: { keywords: [] },
          boardSettingsSortOrderRef: makeRef(DEFAULT_SORT as any),
        }),
      );

      await act(async () => {
        await result.current.fetchIssues(1);
      });

      expect(result.current.issues).toEqual([]);
      expect(result.current.total).toBe(0);
    });

    it("silently handles network errors", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("network failure"));

      const { result } = renderHook(() =>
        useIssueData({
          debouncedQuery: { keywords: [] },
          boardSettingsSortOrderRef: makeRef(DEFAULT_SORT as any),
        }),
      );

      await act(async () => {
        await result.current.fetchIssues(1);
      });

      expect(result.current.issues).toEqual([]);
    });
  });

  describe("fetchTodayIssues", () => {
    it("fetches today issues and updates state on success", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { items: [{ ...MOCK_ISSUE, todayFlag: true, todayOrder: 1 }] },
        }),
      });

      const { result } = renderHook(() =>
        useIssueData({
          debouncedQuery: { keywords: [] },
          boardSettingsSortOrderRef: makeRef(DEFAULT_SORT as any),
        }),
      );

      await act(async () => {
        await result.current.fetchTodayIssues();
      });

      expect(result.current.todayIssues).toHaveLength(1);
      expect(result.current.todayIssues[0].todayFlag).toBe(true);
    });

    it("silently handles network errors", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("network failure"));

      const { result } = renderHook(() =>
        useIssueData({
          debouncedQuery: { keywords: [] },
          boardSettingsSortOrderRef: makeRef(DEFAULT_SORT as any),
        }),
      );

      await act(async () => {
        await result.current.fetchTodayIssues();
      });

      expect(result.current.todayIssues).toEqual([]);
    });
  });

  describe("handlePageChange", () => {
    it("updates page and fetches issues", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ data: { items: [MOCK_ISSUE], total: 5 } }),
      });

      const { result } = renderHook(() =>
        useIssueData({
          debouncedQuery: { keywords: [] },
          boardSettingsSortOrderRef: makeRef(DEFAULT_SORT as any),
        }),
      );

      await act(async () => {
        await result.current.handlePageChange(3);
      });

      expect(result.current.page).toBe(3);
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("setters", () => {
    it("exposes setIssues, setTodayIssues, setLoading, and setPage", () => {
      const { result } = renderHook(() =>
        useIssueData({
          debouncedQuery: { keywords: [] },
          boardSettingsSortOrderRef: makeRef(DEFAULT_SORT as any),
        }),
      );

      act(() => {
        result.current.setIssues([MOCK_ISSUE]);
      });
      expect(result.current.issues).toEqual([MOCK_ISSUE]);

      act(() => {
        result.current.setTodayIssues([{ ...MOCK_ISSUE, todayFlag: true }]);
      });
      expect(result.current.todayIssues).toHaveLength(1);

      act(() => {
        result.current.setLoading(false);
      });
      expect(result.current.loading).toBe(false);

      act(() => {
        result.current.setPage(5);
      });
      expect(result.current.page).toBe(5);
    });
  });
});
