/** @jest-environment jsdom */
import { act, renderHook } from "@testing-library/react";

import { useDashboardDnD } from "@/hooks/useDashboardDnD";
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
  todayAddedAt: null,
  providerCreatedAt: null,
  providerUpdatedAt: null,
  pinned: false,
  project: { displayName: "repo", issueProvider: { iconUrl: null, displayName: "GitHub" } },
};

function makeDragEvent(overrides: Record<string, unknown> = {}) {
  return {
    active: { id: "a", data: { current: { type: "todo-item", issueId: "a" } } },
    over: null,
    ...overrides,
  } as any;
}

describe("useDashboardDnD", () => {
  const handleAddToToday = jest.fn().mockResolvedValue(undefined);
  const handleRemoveFromToday = jest.fn().mockResolvedValue(undefined);
  const handleReorder = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function renderHookWithDnD(overrides: Record<string, unknown> = {}) {
    return renderHook(() =>
      useDashboardDnD({
        issues: [ISSUE_A],
        todayIssuesSorted: [ISSUE_B],
        handleAddToToday,
        handleRemoveFromToday,
        handleReorder,
        ...overrides,
      }),
    );
  }

  it("returns undefined activeIssue and false isDraggingOutside initially", () => {
    const { result } = renderHookWithDnD();
    expect(result.current.activeIssue).toBeUndefined();
    expect(result.current.isDraggingOutside).toBe(false);
  });

  describe("handleDragStart", () => {
    it("sets activeDragId for todo-item type", () => {
      const { result } = renderHookWithDnD();
      act(() => {
        result.current.handleDragStart(makeDragEvent());
      });
      expect(result.current.activeIssue).toEqual(ISSUE_A);
    });

    it("sets activeDragId for today-item type", () => {
      const { result } = renderHookWithDnD();
      act(() => {
        result.current.handleDragStart(
          makeDragEvent({ active: { id: "b", data: { current: { type: "today-item", issueId: "b" } } } }),
        );
      });
      expect(result.current.activeIssue).toEqual(ISSUE_B);
    });

    it("does not set activeDragId for unknown type", () => {
      const { result } = renderHookWithDnD();
      act(() => {
        result.current.handleDragStart(
          makeDragEvent({ active: { id: "x", data: { current: { type: "unknown" } } } }),
        );
      });
      expect(result.current.activeIssue).toBeUndefined();
    });
  });

  describe("handleDragMove", () => {
    it("sets isDraggingOutside=true when today-item leaves today area", () => {
      const { result } = renderHookWithDnD();

      act(() => {
        result.current.handleDragStart(
          makeDragEvent({ active: { id: "b", data: { current: { type: "today-item", issueId: "b" } } } }),
        );
      });

      act(() => {
        result.current.handleDragMove(
          makeDragEvent({ over: null, active: { id: "b", data: { current: { type: "today-item" } } } }),
        );
      });

      expect(result.current.isDraggingOutside).toBe(true);
    });

    it("resets isDraggingOutside when today-item re-enters today area", () => {
      const { result } = renderHookWithDnD();

      act(() => {
        result.current.handleDragStart(
          makeDragEvent({ active: { id: "b", data: { current: { type: "today-item", issueId: "b" } } } }),
        );
      });

      act(() => {
        result.current.handleDragMove(
          makeDragEvent({ over: null, active: { id: "b", data: { current: { type: "today-item" } } } }),
        );
      });
      expect(result.current.isDraggingOutside).toBe(true);

      act(() => {
        result.current.handleDragMove(
          makeDragEvent({
            over: { id: "today-drop-zone" },
            active: { id: "b", data: { current: { type: "today-item" } } },
          }),
        );
      });
      expect(result.current.isDraggingOutside).toBe(false);
    });

    it("resets isDraggingOutside for non-today-item drag", () => {
      const { result } = renderHookWithDnD();

      act(() => {
        result.current.handleDragStart(
          makeDragEvent({ active: { id: "a", data: { current: { type: "todo-item", issueId: "a" } } } }),
        );
      });

      act(() => {
        result.current.handleDragMove(
          makeDragEvent({ over: null, active: { id: "a", data: { current: { type: "todo-item" } } } }),
        );
      });

      expect(result.current.isDraggingOutside).toBe(false);
    });
  });

  describe("handleDragCancel", () => {
    it("clears activeDragId and isDraggingOutside", () => {
      const { result } = renderHookWithDnD();

      act(() => {
        result.current.handleDragStart(makeDragEvent());
      });
      expect(result.current.activeIssue).toBeDefined();

      act(() => {
        result.current.handleDragCancel();
      });
      expect(result.current.activeIssue).toBeUndefined();
      expect(result.current.isDraggingOutside).toBe(false);
    });
  });

  describe("handleDragEnd", () => {
    it("does nothing when activeData is undefined", () => {
      const { result } = renderHookWithDnD();
      act(() => {
        result.current.handleDragEnd(
          makeDragEvent({ active: { id: "a", data: { current: undefined } } }),
        );
      });
      expect(handleAddToToday).not.toHaveBeenCalled();
    });

    it("calls handleAddToToday when todo-item is dropped on today area", async () => {
      const { result } = renderHookWithDnD();

      await act(async () => {
        result.current.handleDragEnd(
          makeDragEvent({
            over: { id: "today-drop-zone", data: { current: {} } },
          }),
        );
      });

      expect(handleAddToToday).toHaveBeenCalledWith("a");
    });

    it("calls handleRemoveFromToday when today-item is dropped outside today area", async () => {
      const { result } = renderHookWithDnD();

      await act(async () => {
        result.current.handleDragEnd(
          makeDragEvent({
            active: { id: "b", data: { current: { type: "today-item", issueId: "b" } } },
            over: null,
          }),
        );
      });

      expect(handleRemoveFromToday).toHaveBeenCalledWith("b");
    });

    it("calls handleReorder when today-item is dropped on another today-item", async () => {
      const ISSUE_C: ClientIssue = { ...ISSUE_B, id: "c", externalId: "3", todayOrder: 2 };
      const { result } = renderHookWithDnD({
        issues: [ISSUE_A],
        todayIssuesSorted: [ISSUE_B, ISSUE_C],
      });

      await act(async () => {
        result.current.handleDragEnd(
          makeDragEvent({
            active: { id: "b", data: { current: { type: "today-item", issueId: "b" } } },
            over: { id: "c", data: { current: { type: "today-item" } } },
          }),
        );
      });

      expect(handleReorder).toHaveBeenCalled();
    });

    it("does not call handleReorder when dropped on itself", async () => {
      const { result } = renderHookWithDnD();

      await act(async () => {
        result.current.handleDragEnd(
          makeDragEvent({
            active: { id: "b", data: { current: { type: "today-item", issueId: "b" } } },
            over: { id: "b", data: { current: { type: "today-item" } } },
          }),
        );
      });

      expect(handleReorder).not.toHaveBeenCalled();
    });

    it("recognizes drop on today-item via data.current type", async () => {
      const { result } = renderHookWithDnD();

      await act(async () => {
        result.current.handleDragEnd(
          makeDragEvent({
            over: { id: "some-id", data: { current: { type: "today-item" } } },
          }),
        );
      });

      expect(handleAddToToday).toHaveBeenCalledWith("a");
    });

    it("does not call handleAddToToday when todo-item is dropped outside today area", async () => {
      const { result } = renderHookWithDnD();

      await act(async () => {
        result.current.handleDragEnd(
          makeDragEvent({
            over: { id: "other-area", data: { current: { type: "other" } } },
          }),
        );
      });

      expect(handleAddToToday).not.toHaveBeenCalled();
    });

    it("clears activeDragId after drop", async () => {
      const { result } = renderHookWithDnD();

      act(() => {
        result.current.handleDragStart(makeDragEvent());
      });
      expect(result.current.activeIssue).toBeDefined();

      await act(async () => {
        result.current.handleDragEnd(makeDragEvent());
      });
      expect(result.current.activeIssue).toBeUndefined();
    });
  });
});
