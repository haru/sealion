/** @jest-environment node */

// Mock @linear/sdk before any imports
const mockViewer = jest.fn();
const mockTeams = jest.fn();
const mockIssues = jest.fn();
const mockIssue = jest.fn();
const mockUpdateIssue = jest.fn();
const mockCreateComment = jest.fn();

jest.mock("@linear/sdk", () => ({
  LinearClient: jest.fn().mockImplementation(() => ({
    get viewer() { return mockViewer(); },
    teams: mockTeams,
    issues: mockIssues,
    issue: mockIssue,
    updateIssue: mockUpdateIssue,
    createComment: mockCreateComment,
  })),
}));

import { LinearAdapter } from "@/services/issue-provider/linear/linear";

// Helper: build a minimal team node response
function makeTeamNodes(teams: { id: string; name: string }[], hasNextPage = false, endCursor?: string) {
  return {
    nodes: teams,
    pageInfo: { hasNextPage, endCursor: endCursor ?? null },
  };
}

// Helper: build a minimal issue node response
function makeIssueNodes(
  issues: {
    id: string;
    title: string;
    url: string;
    dueDate?: string | null;
    createdAt: string;
    updatedAt: string;
  }[],
  hasNextPage = false,
  endCursor?: string,
) {
  return {
    nodes: issues,
    pageInfo: { hasNextPage, endCursor: endCursor ?? null },
  };
}

describe("LinearAdapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── testConnection ────────────────────────────────────────────────────────

  describe("testConnection", () => {
    it("resolves when viewer query succeeds", async () => {
      mockViewer.mockResolvedValue({ id: "user-1", name: "Test User" });
      const adapter = new LinearAdapter("lin_api_test");
      await expect(adapter.testConnection()).resolves.toBeUndefined();
    });

    it("throws when viewer query rejects (invalid key)", async () => {
      mockViewer.mockRejectedValue(new Error("Authentication required"));
      const adapter = new LinearAdapter("lin_api_bad");
      await expect(adapter.testConnection()).rejects.toThrow();
    });

    it("throws on network error", async () => {
      mockViewer.mockRejectedValue(new Error("Network error"));
      const adapter = new LinearAdapter("lin_api_test");
      await expect(adapter.testConnection()).rejects.toThrow("Network error");
    });
  });

  // ─── listProjects ──────────────────────────────────────────────────────────

  describe("listProjects", () => {
    it("returns mapped teams for a single page", async () => {
      mockTeams.mockResolvedValue(makeTeamNodes([
        { id: "team-1", name: "Engineering" },
        { id: "team-2", name: "Design" },
      ]));

      const adapter = new LinearAdapter("lin_api_test");
      const projects = await adapter.listProjects();

      expect(projects).toEqual([
        { externalId: "team-1", displayName: "Engineering" },
        { externalId: "team-2", displayName: "Design" },
      ]);
      expect(mockTeams).toHaveBeenCalledWith({ first: 100 });
    });

    it("paginates until hasNextPage is false", async () => {
      mockTeams
        .mockResolvedValueOnce(makeTeamNodes([{ id: "team-1", name: "Eng" }], true, "cursor-1"))
        .mockResolvedValueOnce(makeTeamNodes([{ id: "team-2", name: "Design" }], true, "cursor-2"))
        .mockResolvedValueOnce(makeTeamNodes([{ id: "team-3", name: "Product" }], false));

      const adapter = new LinearAdapter("lin_api_test");
      const projects = await adapter.listProjects();

      expect(projects).toHaveLength(3);
      expect(mockTeams).toHaveBeenCalledTimes(3);
      expect(mockTeams).toHaveBeenNthCalledWith(2, { first: 100, after: "cursor-1" });
      expect(mockTeams).toHaveBeenNthCalledWith(3, { first: 100, after: "cursor-2" });
    });

    it("returns empty array when no teams", async () => {
      mockTeams.mockResolvedValue(makeTeamNodes([]));
      const adapter = new LinearAdapter("lin_api_test");
      const projects = await adapter.listProjects();
      expect(projects).toEqual([]);
    });
  });

  // ─── fetchAssignedIssues ───────────────────────────────────────────────────

  describe("fetchAssignedIssues", () => {
    it("fetches assigned issues with correct filter and maps fields", async () => {
      mockViewer.mockResolvedValue({ id: "viewer-1" });
      mockIssues.mockResolvedValue(makeIssueNodes([
        {
          id: "issue-1",
          title: "Fix the bug",
          url: "https://linear.app/team/issue/ENG-1",
          dueDate: "2026-04-15",
          createdAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-02T00:00:00.000Z",
        },
      ]));

      const adapter = new LinearAdapter("lin_api_test");
      const issues = await adapter.fetchAssignedIssues("team-1");

      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        externalId: "issue-1",
        title: "Fix the bug",
        dueDate: new Date("2026-04-15"),
        externalUrl: "https://linear.app/team/issue/ENG-1",
        isUnassigned: false,
        providerCreatedAt: new Date("2026-04-01T00:00:00.000Z"),
        providerUpdatedAt: new Date("2026-04-02T00:00:00.000Z"),
      });

      expect(mockIssues).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            team: { id: { eq: "team-1" } },
            assignee: { id: { eq: "viewer-1" } },
            state: { type: { nin: ["completed", "cancelled"] } },
          }),
        }),
      );
    });

    it("handles null dueDate", async () => {
      mockViewer.mockResolvedValue({ id: "viewer-1" });
      mockIssues.mockResolvedValue(makeIssueNodes([
        { id: "issue-2", title: "No due date", url: "https://linear.app/x", dueDate: null, createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" },
      ]));

      const adapter = new LinearAdapter("lin_api_test");
      const issues = await adapter.fetchAssignedIssues("team-1");
      expect(issues[0].dueDate).toBeNull();
    });

    it("sets isUnassigned to false for all assigned issues", async () => {
      mockViewer.mockResolvedValue({ id: "viewer-1" });
      mockIssues.mockResolvedValue(makeIssueNodes([
        { id: "issue-3", title: "Task", url: "https://linear.app/y", dueDate: null, createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" },
      ]));

      const adapter = new LinearAdapter("lin_api_test");
      const issues = await adapter.fetchAssignedIssues("team-1");
      expect(issues[0].isUnassigned).toBe(false);
    });

    it("paginates until hasNextPage is false", async () => {
      mockViewer.mockResolvedValue({ id: "viewer-1" });
      mockIssues
        .mockResolvedValueOnce(makeIssueNodes(
          [{ id: "issue-1", title: "A", url: "https://x", dueDate: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }],
          true, "cursor-1",
        ))
        .mockResolvedValueOnce(makeIssueNodes(
          [{ id: "issue-2", title: "B", url: "https://y", dueDate: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }],
          false,
        ));

      const adapter = new LinearAdapter("lin_api_test");
      const issues = await adapter.fetchAssignedIssues("team-1");
      expect(issues).toHaveLength(2);
      expect(mockIssues).toHaveBeenCalledTimes(2);
    });

    it("caches viewer ID across multiple calls", async () => {
      mockViewer.mockResolvedValue({ id: "viewer-1" });
      mockIssues.mockResolvedValue(makeIssueNodes([]));

      const adapter = new LinearAdapter("lin_api_test");
      await adapter.fetchAssignedIssues("team-1");
      await adapter.fetchAssignedIssues("team-2");

      // viewer should only be called once
      expect(mockViewer).toHaveBeenCalledTimes(1);
    });

    it("returns empty array when no assigned issues", async () => {
      mockViewer.mockResolvedValue({ id: "viewer-1" });
      mockIssues.mockResolvedValue(makeIssueNodes([]));

      const adapter = new LinearAdapter("lin_api_test");
      const issues = await adapter.fetchAssignedIssues("team-1");
      expect(issues).toEqual([]);
    });
  });

  // ─── fetchUnassignedIssues ─────────────────────────────────────────────────

  describe("fetchUnassignedIssues", () => {
    it("fetches unassigned issues with null assignee filter and sets isUnassigned=true", async () => {
      mockIssues.mockResolvedValue(makeIssueNodes([
        { id: "issue-10", title: "Unassigned task", url: "https://linear.app/z", dueDate: null, createdAt: "2026-04-01T00:00:00.000Z", updatedAt: "2026-04-01T00:00:00.000Z" },
      ]));

      const adapter = new LinearAdapter("lin_api_test");
      const issues = await adapter.fetchUnassignedIssues("team-1");

      expect(issues).toHaveLength(1);
      expect(issues[0].isUnassigned).toBe(true);
      expect(issues[0].externalId).toBe("issue-10");
      expect(mockIssues).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            team: { id: { eq: "team-1" } },
            assignee: null,
            state: { type: { nin: ["completed", "cancelled"] } },
          }),
        }),
      );
    });

    it("paginates until hasNextPage is false", async () => {
      mockIssues
        .mockResolvedValueOnce(makeIssueNodes(
          [{ id: "u-1", title: "A", url: "https://x", dueDate: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }],
          true, "cursor-u-1",
        ))
        .mockResolvedValueOnce(makeIssueNodes(
          [{ id: "u-2", title: "B", url: "https://y", dueDate: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" }],
          false,
        ));

      const adapter = new LinearAdapter("lin_api_test");
      const issues = await adapter.fetchUnassignedIssues("team-1");
      expect(issues).toHaveLength(2);
      expect(mockIssues).toHaveBeenCalledTimes(2);
    });

    it("returns empty array when no unassigned issues", async () => {
      mockIssues.mockResolvedValue(makeIssueNodes([]));
      const adapter = new LinearAdapter("lin_api_test");
      const issues = await adapter.fetchUnassignedIssues("team-1");
      expect(issues).toEqual([]);
    });

    it("does NOT call viewer for unassigned issues", async () => {
      mockIssues.mockResolvedValue(makeIssueNodes([]));
      const adapter = new LinearAdapter("lin_api_test");
      await adapter.fetchUnassignedIssues("team-1");
      expect(mockViewer).not.toHaveBeenCalled();
    });
  });

  // ─── closeIssue ───────────────────────────────────────────────────────────

  describe("closeIssue", () => {
    it("finds first completed-type workflow state and updates issue", async () => {
      const mockStates = {
        nodes: [
          { id: "state-done", type: "completed", name: "Done" },
        ],
      };
      const mockIssueObj = {
        team: Promise.resolve({
          states: jest.fn().mockResolvedValue(mockStates),
        }),
      };
      mockIssue.mockResolvedValue(mockIssueObj);
      mockUpdateIssue.mockResolvedValue({ success: true });

      const adapter = new LinearAdapter("lin_api_test");
      await expect(adapter.closeIssue("team-1", "issue-1")).resolves.toBeUndefined();

      expect(mockIssue).toHaveBeenCalledWith("issue-1");
      expect(mockUpdateIssue).toHaveBeenCalledWith("issue-1", { stateId: "state-done" });
    });

    it("uses first completed-type state when multiple exist", async () => {
      const mockStates = {
        nodes: [
          { id: "state-done-1", type: "completed", name: "Done" },
          { id: "state-done-2", type: "completed", name: "Deployed" },
        ],
      };
      const mockIssueObj = {
        team: Promise.resolve({
          states: jest.fn().mockResolvedValue(mockStates),
        }),
      };
      mockIssue.mockResolvedValue(mockIssueObj);
      mockUpdateIssue.mockResolvedValue({ success: true });

      const adapter = new LinearAdapter("lin_api_test");
      await adapter.closeIssue("team-1", "issue-1");
      expect(mockUpdateIssue).toHaveBeenCalledWith("issue-1", { stateId: "state-done-1" });
    });

    it("throws when no completed-type state exists for the team", async () => {
      const mockStates = {
        nodes: [
          { id: "state-todo", type: "unstarted", name: "Todo" },
          { id: "state-prog", type: "started", name: "In Progress" },
        ],
      };
      const mockIssueObj = {
        team: Promise.resolve({
          states: jest.fn().mockResolvedValue(mockStates),
        }),
      };
      mockIssue.mockResolvedValue(mockIssueObj);

      const adapter = new LinearAdapter("lin_api_test");
      await expect(adapter.closeIssue("team-1", "issue-1")).rejects.toThrow();
    });

    it("throws when issue fetch fails", async () => {
      mockIssue.mockRejectedValue(new Error("Not found"));
      const adapter = new LinearAdapter("lin_api_test");
      await expect(adapter.closeIssue("team-1", "issue-99")).rejects.toThrow("Not found");
    });
  });

  // ─── addComment ───────────────────────────────────────────────────────────

  describe("addComment", () => {
    it("calls createComment with issueId and body", async () => {
      mockCreateComment.mockResolvedValue({ success: true });
      const adapter = new LinearAdapter("lin_api_test");
      await expect(adapter.addComment("team-1", "issue-1", "Great work!")).resolves.toBeUndefined();
      expect(mockCreateComment).toHaveBeenCalledWith({ issueId: "issue-1", body: "Great work!" });
    });

    it("ignores teamId parameter (uses issueId only)", async () => {
      mockCreateComment.mockResolvedValue({ success: true });
      const adapter = new LinearAdapter("lin_api_test");
      await adapter.addComment("any-team", "issue-42", "comment");
      expect(mockCreateComment).toHaveBeenCalledWith({ issueId: "issue-42", body: "comment" });
    });

    it("throws when createComment fails", async () => {
      mockCreateComment.mockRejectedValue(new Error("Forbidden"));
      const adapter = new LinearAdapter("lin_api_test");
      await expect(adapter.addComment("team-1", "issue-1", "hi")).rejects.toThrow("Forbidden");
    });
  });
});
