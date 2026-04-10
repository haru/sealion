/** @jest-environment node */

jest.mock("axios", () => ({
  create: jest.fn().mockReturnValue({
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  }),
}));

import axios from "axios";

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPatch = jest.fn();

(axios.create as jest.Mock).mockReturnValue({
  get: mockGet,
  post: mockPost,
  patch: mockPatch,
});

import { BacklogAdapter } from "@/services/issue-provider/backlog/backlog";

// ─── Sample data ─────────────────────────────────────────────────────────────

const MYSELF = { id: 42, userId: "taro", name: "Taro Yamada" };

const SAMPLE_ISSUE = {
  id: 101,
  issueKey: "PROJECT-101",
  summary: "Fix the login bug",
  dueDate: "2026-05-01",
  created: "2026-03-01T10:00:00Z",
  updated: "2026-04-01T12:00:00Z",
  assignee: { id: 42, name: "Taro Yamada" },
  status: { id: 1, name: "未対応" },
};

const UNASSIGNED_ISSUE = {
  id: 202,
  issueKey: "PROJECT-202",
  summary: "Unassigned task",
  dueDate: null,
  created: "2026-03-15T08:00:00Z",
  updated: "2026-04-05T09:00:00Z",
  assignee: null,
  status: { id: 2, name: "処理中" },
};

const SAMPLE_PROJECTS = [
  { id: 1, name: "Alpha Project", projectKey: "ALPHA" },
  { id: 2, name: "Beta Project", projectKey: "BETA" },
];

// ─── constructor ──────────────────────────────────────────────────────────────

describe("BacklogAdapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (axios.create as jest.Mock).mockReturnValue({
      get: mockGet,
      post: mockPost,
      patch: mockPatch,
    });
  });

  describe("constructor", () => {
    it("creates an axios client with the correct baseURL including /api/v2", () => {
      new BacklogAdapter("https://myspace.backlog.com", "my-key");
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: "https://myspace.backlog.com/api/v2",
        }),
      );
    });

    it("strips a trailing slash from baseUrl", () => {
      new BacklogAdapter("https://myspace.backlog.com/", "my-key");
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: "https://myspace.backlog.com/api/v2",
        }),
      );
    });

    it("passes apiKey via params default", () => {
      new BacklogAdapter("https://myspace.backlog.com", "secret-key");
      const call = (axios.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      const params = call.params as Record<string, string>;
      expect(params.apiKey).toBe("secret-key");
    });
  });

  // ─── testConnection ───────────────────────────────────────────────────────

  describe("testConnection", () => {
    it("calls GET /users/myself and resolves", async () => {
      mockGet.mockResolvedValue({ data: MYSELF });
      const adapter = new BacklogAdapter("https://myspace.backlog.com", "valid-key");
      await expect(adapter.testConnection()).resolves.toBeUndefined();
      expect(mockGet).toHaveBeenCalledWith("/users/myself");
    });

    it("re-throws when GET /users/myself fails", async () => {
      mockGet.mockRejectedValue(new Error("Unauthorized"));
      const adapter = new BacklogAdapter("https://myspace.backlog.com", "bad-key");
      await expect(adapter.testConnection()).rejects.toThrow("Unauthorized");
    });
  });

  // ─── listProjects ─────────────────────────────────────────────────────────

  describe("listProjects", () => {
    it("maps projects to ExternalProject array", async () => {
      mockGet.mockResolvedValue({ data: SAMPLE_PROJECTS });
      const adapter = new BacklogAdapter("https://myspace.backlog.com", "my-key");
      const result = await adapter.listProjects();
      expect(result).toEqual([
        { externalId: "1", displayName: "Alpha Project" },
        { externalId: "2", displayName: "Beta Project" },
      ]);
      expect(mockGet).toHaveBeenCalledWith("/projects");
    });

    it("returns an empty array when there are no projects", async () => {
      mockGet.mockResolvedValue({ data: [] });
      const adapter = new BacklogAdapter("https://myspace.backlog.com", "my-key");
      const result = await adapter.listProjects();
      expect(result).toEqual([]);
    });
  });

  // ─── fetchAssignedIssues ──────────────────────────────────────────────────

  describe("fetchAssignedIssues", () => {
    it("calls GET /users/myself to obtain myId, then fetches issues with assigneeId filter", async () => {
      mockGet
        .mockResolvedValueOnce({ data: MYSELF })
        .mockResolvedValueOnce({ data: [SAMPLE_ISSUE] });

      const adapter = new BacklogAdapter("https://myspace.backlog.com", "my-key");
      const result = await adapter.fetchAssignedIssues("1");

      expect(mockGet).toHaveBeenNthCalledWith(1, "/users/myself");
      expect(mockGet).toHaveBeenNthCalledWith(
        2,
        "/issues",
        expect.objectContaining({
          params: expect.objectContaining({
            "assigneeId[]": 42,
            "projectId[]": "1",
          }),
        }),
      );
      expect(result).toHaveLength(1);
    });

    it("maps BacklogIssue to NormalizedIssue correctly", async () => {
      mockGet
        .mockResolvedValueOnce({ data: MYSELF })
        .mockResolvedValueOnce({ data: [SAMPLE_ISSUE] });

      const adapter = new BacklogAdapter("https://myspace.backlog.com", "my-key");
      const [issue] = await adapter.fetchAssignedIssues("1");

      expect(issue).toEqual({
        externalId: "101",
        title: "Fix the login bug",
        dueDate: new Date("2026-05-01"),
        externalUrl: "https://myspace.backlog.com/view/PROJECT-101",
        isUnassigned: false,
        providerCreatedAt: new Date("2026-03-01T10:00:00Z"),
        providerUpdatedAt: new Date("2026-04-01T12:00:00Z"),
      });
    });

    it("handles null dueDate correctly", async () => {
      const issueNoDue = { ...SAMPLE_ISSUE, dueDate: null };
      mockGet
        .mockResolvedValueOnce({ data: MYSELF })
        .mockResolvedValueOnce({ data: [issueNoDue] });

      const adapter = new BacklogAdapter("https://myspace.backlog.com", "my-key");
      const [issue] = await adapter.fetchAssignedIssues("1");
      expect(issue.dueDate).toBeNull();
    });

    it("paginates: fetches two pages when first page is full", async () => {
      const page1 = Array.from({ length: 100 }, (_, i) => ({
        ...SAMPLE_ISSUE,
        id: i + 1,
        issueKey: `PROJECT-${i + 1}`,
      }));
      const page2 = Array.from({ length: 50 }, (_, i) => ({
        ...SAMPLE_ISSUE,
        id: i + 101,
        issueKey: `PROJECT-${i + 101}`,
      }));

      mockGet
        .mockResolvedValueOnce({ data: MYSELF })
        .mockResolvedValueOnce({ data: page1 })
        .mockResolvedValueOnce({ data: page2 });

      const adapter = new BacklogAdapter("https://myspace.backlog.com", "my-key");
      const result = await adapter.fetchAssignedIssues("1");
      expect(result).toHaveLength(150);
    });

    it("caches userId: calling fetchAssignedIssues twice only calls GET /users/myself once", async () => {
      mockGet
        .mockResolvedValueOnce({ data: MYSELF })
        .mockResolvedValueOnce({ data: [SAMPLE_ISSUE] })
        .mockResolvedValueOnce({ data: [SAMPLE_ISSUE] });

      const adapter = new BacklogAdapter("https://myspace.backlog.com", "my-key");
      await adapter.fetchAssignedIssues("1");
      await adapter.fetchAssignedIssues("1");

      const myselfCalls = mockGet.mock.calls.filter((call) => call[0] === "/users/myself");
      expect(myselfCalls).toHaveLength(1);
    });
  });

  // ─── fetchUnassignedIssues ────────────────────────────────────────────────

  describe("fetchUnassignedIssues", () => {
    it("fetches all issues without assigneeId filter and filters client-side for assignee === null", async () => {
      mockGet.mockResolvedValueOnce({ data: [SAMPLE_ISSUE, UNASSIGNED_ISSUE] });

      const adapter = new BacklogAdapter("https://myspace.backlog.com", "my-key");
      const result = await adapter.fetchUnassignedIssues("1");

      // Only the unassigned issue should be returned
      expect(result).toHaveLength(1);
      expect(result[0].externalId).toBe("202");
      expect(result[0].isUnassigned).toBe(true);

      // Should not include assigneeId in params
      const callParams = (mockGet.mock.calls[0] as unknown[])[1] as { params: Record<string, unknown> };
      expect(callParams.params["assigneeId[]"]).toBeUndefined();
    });

    it("maps unassigned issue to NormalizedIssue correctly", async () => {
      mockGet.mockResolvedValueOnce({ data: [UNASSIGNED_ISSUE] });

      const adapter = new BacklogAdapter("https://myspace.backlog.com", "my-key");
      const [issue] = await adapter.fetchUnassignedIssues("1");

      expect(issue).toEqual({
        externalId: "202",
        title: "Unassigned task",
        dueDate: null,
        externalUrl: "https://myspace.backlog.com/view/PROJECT-202",
        isUnassigned: true,
        providerCreatedAt: new Date("2026-03-15T08:00:00Z"),
        providerUpdatedAt: new Date("2026-04-05T09:00:00Z"),
      });
    });

    it("throws when MAX_PAGES (20) would be exceeded", async () => {
      // Return full pages (100 items) 20 times to trigger the guard on the 21st call
      const fullPage = Array.from({ length: 100 }, (_, i) => ({
        ...UNASSIGNED_ISSUE,
        id: i + 1,
        issueKey: `PROJECT-${i + 1}`,
        assignee: null,
      }));
      mockGet.mockResolvedValue({ data: fullPage });

      const adapter = new BacklogAdapter("https://myspace.backlog.com", "my-key");
      await expect(adapter.fetchUnassignedIssues("1")).rejects.toThrow(/MAX_PAGES/);
    });
  });

  // ─── closeIssue ───────────────────────────────────────────────────────────

  describe("closeIssue", () => {
    it("calls PATCH /issues/{issueId} with statusId 4", async () => {
      mockPatch.mockResolvedValue({ data: {} });
      const adapter = new BacklogAdapter("https://myspace.backlog.com", "my-key");
      await adapter.closeIssue("1", "101");
      expect(mockPatch).toHaveBeenCalledWith("/issues/101", { statusId: 4 });
    });

    it("resolves without returning a value", async () => {
      mockPatch.mockResolvedValue({ data: {} });
      const adapter = new BacklogAdapter("https://myspace.backlog.com", "my-key");
      await expect(adapter.closeIssue("1", "101")).resolves.toBeUndefined();
    });
  });

  // ─── addComment ───────────────────────────────────────────────────────────

  describe("addComment", () => {
    it("calls POST /issues/{issueId}/comments with the comment content", async () => {
      mockPost.mockResolvedValue({ data: {} });
      const adapter = new BacklogAdapter("https://myspace.backlog.com", "my-key");
      await adapter.addComment("1", "101", "This is a comment");
      expect(mockPost).toHaveBeenCalledWith("/issues/101/comments", {
        content: "This is a comment",
      });
    });

    it("resolves without returning a value", async () => {
      mockPost.mockResolvedValue({ data: {} });
      const adapter = new BacklogAdapter("https://myspace.backlog.com", "my-key");
      await expect(adapter.addComment("1", "101", "Done!")).resolves.toBeUndefined();
    });
  });
});
