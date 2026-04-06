/** @jest-environment jsdom */
import { act, renderHook } from "@testing-library/react";

import { useTodayTaskHandlers } from "@/hooks/useTodayTaskHandlers";
import type { ClientIssue } from "@/types/issue";

const ISSUE_A: ClientIssue = {
  id: "a",
  externalId: "1",
  title: "Task A",
  dueDate: null,
  externalUrl: "https://example.com/1",
  isUnassigned: false,
  todayFlag: false,
  todayOrder: null,
  todayAddedAt: null,
  providerCreatedAt: null,
  providerUpdatedAt: null,
  pinned: false,
  project: { displayName: "repo", issueProvider: { iconUrl: null, displayName: "GitHub" } },
};

const ISSUE_B: ClientIssue = {
  id: "b",
  externalId: "2",
  title: "Task B",
  dueDate: null,
  externalUrl: "https://example.com/2",
  isUnassigned: false,
  todayFlag: true,
  todayOrder: 1,
  todayAddedAt: "2025-01-01T00:00:00Z",
  providerCreatedAt: null,
  providerUpdatedAt: null,
  pinned: false,
  project: { displayName: "repo", issueProvider: { iconUrl: null, displayName: "GitHub" } },
};

const ISSUE_C: ClientIssue = {
  id: "c",
  externalId: "3",
  title: "Task C",
  dueDate: null,
  externalUrl: "https://example.com/3",
  isUnassigned: false,
  todayFlag: false,
  todayOrder: null,
  todayAddedAt: null,
  providerCreatedAt: null,
  providerUpdatedAt: null,
  pinned: true,
  project: { displayName: "repo", issueProvider: { iconUrl: null, displayName: "GitHub" } },
};

const DEFAULT_SORT = ["dueDate"];
function makeRef<T>(value: T): React.RefObject<T> {
  return { current: value };
}

interface RenderOptions {
  issues?: ClientIssue[];
  todayIssues?: ClientIssue[];
}

function useStateSaver<T>() {
  let captured: T = [] as unknown as T;
  const getter = () => captured;
  const setter: React.Dispatch<React.SetStateAction<T>> = (action) => {
    if (typeof action === "function") {
      captured = (action as (prev: T) => T)(captured);
    } else {
      captured = action;
    }
  };
  return { getter, setter, init: (val: T) => { captured = val; } };
}

function renderWithState(overrides: RenderOptions = {}) {
  const issueState = useStateSaver<ClientIssue[]>();
  const todayState = useStateSaver<ClientIssue[]>();
  const addMessage = jest.fn();
  const fetchIssues = jest.fn().mockResolvedValue(undefined);
  const t = (key: string) => key;
  const tToday = (key: string) => key;
  const issues = overrides.issues ?? [ISSUE_A];
  const todayIssues = overrides.todayIssues ?? [ISSUE_B];

  issueState.init(issues);
  todayState.init(todayIssues);

  const { result } = renderHook(() =>
    useTodayTaskHandlers({
      issues,
      todayIssues,
      setIssues: issueState.setter,
      setTodayIssues: todayState.setter,
      boardSettingsSortOrderRef: makeRef(DEFAULT_SORT as any),
      addMessage,
      page: 1,
      fetchIssues,
      t,
      tToday,
    }),
  );

  return {
    result,
    addMessage,
    fetchIssues,
    issueState,
    todayState,
  };
}

describe("useTodayTaskHandlers", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns null completeModalIssueId initially", () => {
    const { result } = renderWithState();
    expect(result.current.completeModalIssueId).toBeNull();
  });

  describe("handleComplete", () => {
    it("sets completeModalIssueId to the given id", () => {
      const { result } = renderWithState();
      act(() => { result.current.handleComplete("a"); });
      expect(result.current.completeModalIssueId).toBe("a");
    });
  });

  describe("handleModalCancel", () => {
    it("clears completeModalIssueId", () => {
      const { result } = renderWithState();
      act(() => { result.current.handleComplete("a"); });
      act(() => { result.current.handleModalCancel(); });
      expect(result.current.completeModalIssueId).toBeNull();
    });
  });

  describe("handleModalConfirm", () => {
    it("removes issue from both lists and calls API with comment", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
      const { result, issueState, todayState } = renderWithState({ issues: [ISSUE_A], todayIssues: [ISSUE_B] });

      await act(async () => {
        await result.current.handleModalConfirm("a", "done");
      });

      expect(global.fetch).toHaveBeenCalledWith("/api/issues/a", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closed: true, comment: "done" }),
      });
      expect(issueState.getter()).toEqual([]);
    });

    it("does not include comment when it is empty", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
      const { result } = renderWithState({ issues: [ISSUE_A], todayIssues: [] });

      await act(async () => {
        await result.current.handleModalConfirm("a", "   ");
      });

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body).not.toHaveProperty("comment");
    });

    it("clears completeModalIssueId on success", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
      const { result } = renderWithState({ issues: [ISSUE_A], todayIssues: [] });

      act(() => { result.current.handleComplete("a"); });
      expect(result.current.completeModalIssueId).toBe("a");

      await act(async () => {
        await result.current.handleModalConfirm("a", "");
      });
      expect(result.current.completeModalIssueId).toBeNull();
    });

    it("rolls back both lists on non-ok response and throws", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      const { result, issueState, todayState } = renderWithState({ issues: [ISSUE_A], todayIssues: [ISSUE_B] });

      await expect(
        act(async () => {
          await result.current.handleModalConfirm("a", "done");
        }),
      ).rejects.toThrow("EXTERNAL_UPDATE_FAILED");

      expect(issueState.getter()).toEqual([ISSUE_A]);
      expect(todayState.getter()).toEqual([ISSUE_B]);
    });

    it("rolls back issue in today list that still exists after optimistic removal (non-ok)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      const { result, todayState } = renderWithState({ issues: [ISSUE_A], todayIssues: [ISSUE_A] });

      await expect(
        act(async () => {
          await result.current.handleModalConfirm("a", "");
        }),
      ).rejects.toThrow();

      const todayItems = todayState.getter();
      expect(todayItems).toContainEqual(ISSUE_A);
    });

    it("rolls back on network error and re-throws", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("fail"));
      const { result, issueState, todayState } = renderWithState({ issues: [ISSUE_A], todayIssues: [ISSUE_B] });

      await expect(
        act(async () => {
          await result.current.handleModalConfirm("a", "done");
        }),
      ).rejects.toThrow("fail");

      expect(issueState.getter()).toEqual([ISSUE_A]);
      expect(todayState.getter()).toEqual([ISSUE_B]);
    });

    it("rolls back via spread when issue is no longer in today list after optimistic removal (network error)", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("fail"));
      const { result, todayState } = renderWithState({ issues: [ISSUE_A], todayIssues: [ISSUE_A] });

      await expect(
        act(async () => {
          await result.current.handleModalConfirm("a", "");
        }),
      ).rejects.toThrow();

      const todayItems = todayState.getter();
      expect(todayItems).toContainEqual(ISSUE_A);
    });
  });

  describe("handleTogglePin", () => {
    it("optimistically updates pinned state and calls API", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
      const { result, issueState } = renderWithState({ issues: [ISSUE_A] });

      await act(async () => {
        await result.current.handleTogglePin("a", true);
      });

      expect(global.fetch).toHaveBeenCalledWith("/api/issues/a", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: true }),
      });
      const updatedIssues = issueState.getter();
      expect(updatedIssues[0].pinned).toBe(true);
    });

    it("rolls back pinned state on API failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      const { result, issueState, addMessage } = renderWithState({ issues: [ISSUE_A] });

      await act(async () => {
        await result.current.handleTogglePin("a", true);
      });

      expect(addMessage).toHaveBeenCalledWith("error", "pinToggleError");
      expect(issueState.getter()[0].pinned).toBe(false);
    });

    it("rolls back pinned state on network error", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("net"));
      const { result, issueState, addMessage } = renderWithState({ issues: [ISSUE_C] });

      await act(async () => {
        await result.current.handleTogglePin("c", false);
      });

      expect(addMessage).toHaveBeenCalledWith("error", "pinToggleError");
      expect(issueState.getter()[0].pinned).toBe(true);
    });

    it("does nothing when issue id is not found", async () => {
      const { result } = renderWithState({ issues: [] });
      await act(async () => {
        await result.current.handleTogglePin("nonexistent", true);
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("handleAddToToday", () => {
    it("optimistically moves issue from issues to today list", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { todayFlag: true, todayOrder: 1, todayAddedAt: "2025-01-01" },
        }),
      });
      const { result, issueState, todayState, addMessage } = renderWithState({ issues: [ISSUE_A], todayIssues: [] });

      await act(async () => {
        await result.current.handleAddToToday("a");
      });

      expect(issueState.getter()).toEqual([]);
      expect(todayState.getter()[0].todayFlag).toBe(true);
      expect(addMessage).toHaveBeenCalledWith("information", "addSuccess");
    });

    it("preserves other items in today list when adding succeeds", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { todayFlag: true, todayOrder: 2, todayAddedAt: "2025-01-01" },
        }),
      });
      const { result, todayState } = renderWithState({ issues: [ISSUE_A], todayIssues: [ISSUE_B] });

      await act(async () => {
        await result.current.handleAddToToday("a");
      });

      const items = todayState.getter();
      expect(items).toHaveLength(2);
      expect(items[0].id).toBe("b");
      expect(items[1].id).toBe("a");
      expect(items[1].todayOrder).toBe(2);
    });

    it("updates todayOrder from API response", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { todayFlag: true, todayOrder: 99, todayAddedAt: "2025-01-01" },
        }),
      });
      const { result, todayState } = renderWithState({ issues: [ISSUE_A], todayIssues: [] });

      await act(async () => {
        await result.current.handleAddToToday("a");
      });

      expect(todayState.getter()[0].todayOrder).toBe(99);
    });

    it("rolls back on API failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      const { result, issueState, todayState, addMessage } = renderWithState({ issues: [ISSUE_A], todayIssues: [] });

      await act(async () => {
        await result.current.handleAddToToday("a");
      });

      expect(issueState.getter()).toEqual([ISSUE_A]);
      expect(todayState.getter()).toEqual([]);
      expect(addMessage).toHaveBeenCalledWith("error", "addError");
    });

    it("rolls back on network error", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("net"));
      const { result, issueState, todayState, addMessage } = renderWithState({ issues: [ISSUE_A], todayIssues: [] });

      await act(async () => {
        await result.current.handleAddToToday("a");
      });

      expect(issueState.getter()).toEqual([ISSUE_A]);
      expect(todayState.getter()).toEqual([]);
      expect(addMessage).toHaveBeenCalledWith("error", "addError");
    });

    it("does nothing when issue id is not found in issues", async () => {
      const { result } = renderWithState({ issues: [] });
      await act(async () => {
        await result.current.handleAddToToday("nonexistent");
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("handleRemoveFromToday", () => {
    it("optimistically removes from today and calls API", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
      const { result, todayState, addMessage, fetchIssues } = renderWithState({ todayIssues: [ISSUE_B] });

      await act(async () => {
        await result.current.handleRemoveFromToday("b");
      });

      expect(todayState.getter()).toEqual([]);
      expect(addMessage).toHaveBeenCalledWith("information", "removeSuccess");
      expect(fetchIssues).toHaveBeenCalled();
    });

    it("rolls back on API failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      const { result, todayState, addMessage } = renderWithState({ todayIssues: [ISSUE_B] });

      await act(async () => {
        await result.current.handleRemoveFromToday("b");
      });

      expect(todayState.getter()).toEqual([ISSUE_B]);
      expect(addMessage).toHaveBeenCalledWith("error", "removeError");
    });

    it("rolls back on network error", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("net"));
      const { result, todayState, addMessage } = renderWithState({ todayIssues: [ISSUE_B] });

      await act(async () => {
        await result.current.handleRemoveFromToday("b");
      });

      expect(todayState.getter()).toEqual([ISSUE_B]);
      expect(addMessage).toHaveBeenCalledWith("error", "removeError");
    });

    it("does nothing when issue id is not found in todayIssues", async () => {
      const { result } = renderWithState({ todayIssues: [] });
      await act(async () => {
        await result.current.handleRemoveFromToday("nonexistent");
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("handleReorder", () => {
    it("optimistically reorders today issues by orderedIds position", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
      const { result, todayState } = renderWithState({ todayIssues: [ISSUE_B] });

      await act(async () => {
        await result.current.handleReorder(["b"]);
      });

      expect(todayState.getter()[0].todayOrder).toBe(1);
    });

    it("leaves issues not in orderedIds unchanged", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
      const { result, todayState } = renderWithState({ todayIssues: [ISSUE_B, ISSUE_A] });

      await act(async () => {
        await result.current.handleReorder(["b"]);
      });

      const items = todayState.getter();
      expect(items[0].id).toBe("b");
      expect(items[0].todayOrder).toBe(1);
      expect(items[1].id).toBe("a");
      expect(items[1].todayOrder).toBeNull();
    });

    it("rolls back on API failure", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
      const { result, todayState, addMessage } = renderWithState({ todayIssues: [ISSUE_B] });

      await act(async () => {
        await result.current.handleReorder(["b"]);
      });

      expect(todayState.getter()).toEqual([ISSUE_B]);
      expect(addMessage).toHaveBeenCalledWith("error", "reorderError");
    });

    it("rolls back on network error", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("net"));
      const { result, todayState, addMessage } = renderWithState({ todayIssues: [ISSUE_B] });

      await act(async () => {
        await result.current.handleReorder(["b"]);
      });

      expect(todayState.getter()).toEqual([ISSUE_B]);
      expect(addMessage).toHaveBeenCalledWith("error", "reorderError");
    });
  });
});
