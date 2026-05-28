/** @jest-environment node */

jest.mock("axios", () => ({
  create: jest.fn().mockReturnValue({
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  }),
}));

import axios from "axios";

const mockAxiosInstance = {
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
};
(axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);

import { GitLabAdapter } from "@/services/issue-provider/gitlab/gitlab";

describe("GitLabAdapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosInstance.get.mockReset();
    mockAxiosInstance.patch.mockReset();
    mockAxiosInstance.post.mockReset();
    mockAxiosInstance.put.mockReset();
  });

  describe("constructor", () => {
    it("creates an axios client with the default GitLab.com base URL", () => {
      new GitLabAdapter("glpat_test");
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: "https://gitlab.com/api/v4",
        }),
      );
    });

    it("creates an axios client with a custom base URL", () => {
      new GitLabAdapter("glpat_test", "https://gitlab.example.com");
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: "https://gitlab.example.com/api/v4",
        }),
      );
    });

    it("sets PRIVATE-TOKEN authorization header", () => {
      new GitLabAdapter("glpat_secret");
      const call = (axios.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      const headers = call.headers as Record<string, string>;
      expect(headers["PRIVATE-TOKEN"]).toBe("glpat_secret");
    });

    it("strips trailing slash from custom base URL", () => {
      new GitLabAdapter("glpat_test", "https://gitlab.example.com/");
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: "https://gitlab.example.com/api/v4",
        }),
      );
    });
  });

  describe("testConnection", () => {
    it("resolves when GET /api/v4/user returns 200", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { id: 1, username: "test" } });
      const adapter = new GitLabAdapter("glpat_test");
      await expect(adapter.testConnection()).resolves.toBeUndefined();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/user");
    });

    it("throws when GET /api/v4/user returns 401", async () => {
      mockAxiosInstance.get.mockRejectedValue({ response: { status: 401 } });
      const adapter = new GitLabAdapter("glpat_bad");
      await expect(adapter.testConnection()).rejects.toBeDefined();
    });

    it("throws on network error", async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error("Network error"));
      const adapter = new GitLabAdapter("glpat_test");
      await expect(adapter.testConnection()).rejects.toThrow("Network error");
    });
  });

  describe("listProjects", () => {
    it("returns mapped projects for a single page", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: [
          { id: 1, name_with_namespace: "mygroup/myproject" },
          { id: 2, name_with_namespace: "mygroup/other" },
        ],
        headers: {},
      });
      const adapter = new GitLabAdapter("glpat_test");
      const projects = await adapter.listProjects();
      expect(projects).toEqual([
        { externalId: "1", displayName: "mygroup/myproject" },
        { externalId: "2", displayName: "mygroup/other" },
      ]);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/projects", {
        params: { simple: true, per_page: 100, page: 1, membership: true },
      });
    });

    it("paginates using x-next-page header", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({
          data: [{ id: 1, name_with_namespace: "group/proj1" }],
          headers: { "x-next-page": "2" },
        })
        .mockResolvedValueOnce({
          data: [{ id: 2, name_with_namespace: "group/proj2" }],
          headers: { "x-next-page": "3" },
        })
        .mockResolvedValueOnce({
          data: [{ id: 3, name_with_namespace: "group/proj3" }],
          headers: {},
        });
      const adapter = new GitLabAdapter("glpat_test");
      const projects = await adapter.listProjects();
      expect(projects).toHaveLength(3);
      expect(projects[2]).toEqual({ externalId: "3", displayName: "group/proj3" });
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
    });

    it("returns empty array when no projects", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: [],
        headers: {},
      });
      const adapter = new GitLabAdapter("glpat_test");
      const projects = await adapter.listProjects();
      expect(projects).toEqual([]);
    });

    it("stops pagination when x-next-page is empty string", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: [{ id: 1, name_with_namespace: "group/proj" }],
        headers: { "x-next-page": "" },
      });
      const adapter = new GitLabAdapter("glpat_test");
      const projects = await adapter.listProjects();
      expect(projects).toHaveLength(1);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });
  });

  function makeGitLabIssue(overrides: Record<string, unknown> = {}) {
    return {
      id: 101,
      iid: 5,
      title: "Bug fix",
      web_url: "https://gitlab.com/group/proj/-/issues/5",
      due_date: null as string | null,
      assignees: [{ id: 42 }],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      ...overrides,
    };
  }

  function makeGitLabMR(overrides: Record<string, unknown> = {}) {
    return {
      id: 201,
      iid: 10,
      title: "MR title",
      web_url: "https://gitlab.com/group/proj/-/merge_requests/10",
      due_date: null as string | null,
      assignees: [{ id: 42 }] as { id: number }[],
      reviewers: [] as { id: number }[],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      ...overrides,
    };
  }

  describe("fetchAssignedIssues", () => {
    it("fetches issues assigned to current user and maps correctly", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { id: 42 } })
        .mockResolvedValueOnce({
          data: [
            {
              id: 101,
              iid: 5,
              title: "Bug fix",
              web_url: "https://gitlab.com/group/proj/-/issues/5",
              due_date: "2026-04-15",
              assignees: [{ id: 42 }],
              created_at: "2026-04-01T00:00:00Z",
              updated_at: "2026-04-01T12:00:00Z",
            },
          ],
          headers: {},
        })
        .mockResolvedValueOnce({ data: [], headers: {} })
        .mockResolvedValueOnce({ data: [], headers: {} });
      const adapter = new GitLabAdapter("glpat_test");
      const issues = await adapter.fetchAssignedIssues("1");
      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        externalId: "101",
        title: "Bug fix",
        dueDate: new Date("2026-04-15"),
        externalUrl: "https://gitlab.com/group/proj/-/issues/5",
        isUnassigned: false,
        providerCreatedAt: new Date("2026-04-01T00:00:00Z"),
        providerUpdatedAt: new Date("2026-04-01T12:00:00Z"),
      });
    });

    it("handles pagination for assigned issues", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { id: 42 } })
        .mockResolvedValueOnce({
          data: [{ id: 101, iid: 1, title: "A", web_url: "https://x", due_date: null, assignees: [{ id: 42 }], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }],
          headers: { "x-next-page": "2" },
        })
        .mockResolvedValueOnce({
          data: [{ id: 102, iid: 2, title: "B", web_url: "https://y", due_date: null, assignees: [{ id: 42 }], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }],
          headers: {},
        })
        .mockResolvedValueOnce({ data: [], headers: {} })
        .mockResolvedValueOnce({ data: [], headers: {} });
      const adapter = new GitLabAdapter("glpat_test");
      const issues = await adapter.fetchAssignedIssues("1");
      expect(issues).toHaveLength(2);
    });

    it("returns empty array when no assigned issues", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { id: 42 } })
        .mockResolvedValueOnce({ data: [], headers: {} })
        .mockResolvedValueOnce({ data: [], headers: {} })
        .mockResolvedValueOnce({ data: [], headers: {} });
      const adapter = new GitLabAdapter("glpat_test");
      const issues = await adapter.fetchAssignedIssues("1");
      expect(issues).toEqual([]);
    });

    it("caches user ID across multiple calls", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { id: 42 } })
        .mockResolvedValueOnce({
          data: [{ id: 101, iid: 1, title: "A", web_url: "https://x", due_date: null, assignees: [{ id: 42 }], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }],
          headers: {},
        })
        .mockResolvedValueOnce({ data: [], headers: {} })
        .mockResolvedValueOnce({ data: [], headers: {} })
        .mockResolvedValueOnce({
          data: [{ id: 102, iid: 2, title: "B", web_url: "https://y", due_date: null, assignees: [{ id: 42 }], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }],
          headers: {},
        })
        .mockResolvedValueOnce({ data: [], headers: {} })
        .mockResolvedValueOnce({ data: [], headers: {} });
      const adapter = new GitLabAdapter("glpat_test");
      await adapter.fetchAssignedIssues("1");
      await adapter.fetchAssignedIssues("1");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/user");
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(7);
    });

    it("fetches assignee MRs with mr- prefix externalId using iid (not global id)", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { id: 42 } })
        .mockResolvedValueOnce({ data: [], headers: {} })
        .mockResolvedValueOnce({
          data: [makeGitLabMR({ id: 300, iid: 11, title: "My MR", assignees: [{ id: 42 }], reviewers: [] })],
          headers: {},
        })
        .mockResolvedValueOnce({
          data: [],
          headers: {},
        });
      const adapter = new GitLabAdapter("glpat_test");
      const issues = await adapter.fetchAssignedIssues("1");
      expect(issues).toHaveLength(1);
      expect(issues[0].externalId).toBe("mr-11"); // iid, not global id
      expect(issues[0].title).toBe("My MR");
      expect(issues[0].isUnassigned).toBe(false);
    });

    it("fetches reviewer MRs with mr- prefix externalId", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { id: 42 } })
        .mockResolvedValueOnce({ data: [], headers: {} })
        .mockResolvedValueOnce({
          data: [],
          headers: {},
        })
        .mockResolvedValueOnce({
          data: [makeGitLabMR({ id: 400, iid: 12, title: "Review MR", assignees: [], reviewers: [{ id: 42 }] })],
          headers: {},
        });
      const adapter = new GitLabAdapter("glpat_test");
      const issues = await adapter.fetchAssignedIssues("1");
      expect(issues).toHaveLength(1);
      expect(issues[0].externalId).toBe("mr-12"); // iid, not global id
      expect(issues[0].title).toBe("Review MR");
      expect(issues[0].isUnassigned).toBe(false);
    });

    it("does not collide issue and MR with same iid via mr- prefix", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { id: 42 } })
        .mockResolvedValueOnce({
          data: [makeGitLabIssue({ id: 500, iid: 1, title: "Issue 500", web_url: "https://gitlab.com/g/p/-/issues/1" })],
          headers: {},
        })
        .mockResolvedValueOnce({
          // MR has iid=2 (different from issue iid=1 by coincidence, but namespaced by mr-)
          data: [makeGitLabMR({ id: 500, iid: 2, title: "MR 500", web_url: "https://gitlab.com/g/p/-/merge_requests/2" })],
          headers: {},
        })
        .mockResolvedValueOnce({
          data: [],
          headers: {},
        });
      const adapter = new GitLabAdapter("glpat_test");
      const issues = await adapter.fetchAssignedIssues("1");
      expect(issues).toHaveLength(2);
      const externalIds = issues.map((i) => i.externalId);
      expect(externalIds).toContain("500"); // issue externalId = global id
      expect(externalIds).toContain("mr-2"); // MR externalId = mr-{iid}
    });

    it("deduplicates MR that appears in both assignee and reviewer lists (I-5)", async () => {
      const sharedMR = makeGitLabMR({ id: 999, iid: 7, title: "Shared MR", assignees: [{ id: 42 }], reviewers: [{ id: 42 }] });
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { id: 42 } })
        .mockResolvedValueOnce({ data: [], headers: {} })
        .mockResolvedValueOnce({ data: [sharedMR], headers: {} }) // assignee MRs
        .mockResolvedValueOnce({ data: [sharedMR], headers: {} }); // reviewer MRs — same MR
      const adapter = new GitLabAdapter("glpat_test");
      const issues = await adapter.fetchAssignedIssues("1");
      expect(issues).toHaveLength(1);
      expect(issues[0].externalId).toBe("mr-7");
    });

    it("propagates error when MR fetch fails (I-7)", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { id: 42 } })
        .mockResolvedValueOnce({ data: [], headers: {} }) // issues
        .mockRejectedValueOnce({ response: { status: 401 } }); // assignee MRs fail
      const adapter = new GitLabAdapter("glpat_test");
      await expect(adapter.fetchAssignedIssues("1")).rejects.toBeDefined();
    });

    it("closeIssue branches on mr- prefix - uses iid directly without global API call (C-2)", async () => {
      mockAxiosInstance.put.mockResolvedValueOnce({});
      const adapter = new GitLabAdapter("glpat_test");
      await adapter.closeIssue("1", "mr-15"); // mr-{iid}
      expect(mockAxiosInstance.get).not.toHaveBeenCalled(); // no global MR lookup
      expect(mockAxiosInstance.put).toHaveBeenCalledWith("/projects/1/merge_requests/15", {
        state_event: "close",
      });
    });

    it("addComment branches on mr- prefix - uses iid directly without global API call (C-2)", async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({});
      const adapter = new GitLabAdapter("glpat_test");
      await adapter.addComment("1", "mr-15", "Looks good"); // mr-{iid}
      expect(mockAxiosInstance.get).not.toHaveBeenCalled(); // no global MR lookup
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/projects/1/merge_requests/15/notes", {
        body: "Looks good",
      });
    });

    it("closeIssue falls back to issue path for non-MR externalId (I-6 regression)", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { iid: 42 } });
      mockAxiosInstance.put.mockResolvedValueOnce({});
      const adapter = new GitLabAdapter("glpat_test");
      await adapter.closeIssue("1", "101");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/issues/101");
      expect(mockAxiosInstance.put).toHaveBeenCalledWith("/projects/1/issues/42", { state_event: "close" });
    });

    it("addComment falls back to issue path for non-MR externalId (I-6 regression)", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { iid: 42 } });
      mockAxiosInstance.post.mockResolvedValueOnce({});
      const adapter = new GitLabAdapter("glpat_test");
      await adapter.addComment("1", "101", "comment");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/issues/101");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/projects/1/issues/42/notes", { body: "comment" });
    });

    it("excludes approval rule MRs (FR-013) — only reviewers field matters", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { id: 42 } })
        .mockResolvedValueOnce({ data: [], headers: {} })
        .mockResolvedValueOnce({
          data: [],
          headers: {},
        })
        .mockResolvedValueOnce({
          // iid=10 (default in makeGitLabMR) so externalId becomes "mr-10"
          data: [makeGitLabMR({ id: 600, reviewers: [{ id: 42 }], approver_ids: [42] })],
          headers: {},
        });
      const adapter = new GitLabAdapter("glpat_test");
      const issues = await adapter.fetchAssignedIssues("1");
      expect(issues).toHaveLength(1);
      expect(issues[0].externalId).toBe("mr-10"); // mr-{iid}
    });
  });

  describe("fetchUnassignedIssues", () => {
    it("fetches unassigned issues with assignee_id=None", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: [
          {
            id: 201,
            iid: 10,
            title: "Unassigned issue",
            web_url: "https://gitlab.com/group/proj/-/issues/10",
            due_date: null,
            assignees: [],
            created_at: "2026-04-01T00:00:00Z",
            updated_at: "2026-04-01T12:00:00Z",
          },
        ],
        headers: {},
      });
      const adapter = new GitLabAdapter("glpat_test");
      const issues = await adapter.fetchUnassignedIssues("1");
      expect(issues).toHaveLength(1);
      expect(issues[0].isUnassigned).toBe(true);
      expect(issues[0].externalId).toBe("201");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/projects/1/issues", {
        params: { state: "opened", assignee_id: "None", per_page: 100, page: 1 },
      });
    });

    it("returns empty array when no unassigned issues", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: [], headers: {} });
      const adapter = new GitLabAdapter("glpat_test");
      const issues = await adapter.fetchUnassignedIssues("1");
      expect(issues).toEqual([]);
    });
  });

  describe("closeIssue", () => {
    it("resolves IID from global ID and closes the issue", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { iid: 42 } });
      mockAxiosInstance.put.mockResolvedValueOnce({});
      const adapter = new GitLabAdapter("glpat_test");
      await adapter.closeIssue("1", "101");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/issues/101");
      expect(mockAxiosInstance.put).toHaveBeenCalledWith("/projects/1/issues/42", {
        state_event: "close",
      });
    });

    it("throws when global issue ID is not found (404)", async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({ response: { status: 404 } });
      const adapter = new GitLabAdapter("glpat_test");
      await expect(adapter.closeIssue("1", "999")).rejects.toBeDefined();
    });

    it("throws on 401 unauthorized", async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({ response: { status: 401 } });
      const adapter = new GitLabAdapter("glpat_test");
      await expect(adapter.closeIssue("1", "101")).rejects.toBeDefined();
    });
  });

  describe("addComment", () => {
    it("resolves IID and posts a comment note", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { iid: 42 } });
      mockAxiosInstance.post.mockResolvedValueOnce({});
      const adapter = new GitLabAdapter("glpat_test");
      await adapter.addComment("1", "101", "Closing this issue");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/issues/101");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/projects/1/issues/42/notes", {
        body: "Closing this issue",
      });
    });

    it("throws when issue is not found", async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({ response: { status: 404 } });
      const adapter = new GitLabAdapter("glpat_test");
      await expect(adapter.addComment("1", "999", "comment")).rejects.toBeDefined();
    });

    it("throws on 401 unauthorized", async () => {
      mockAxiosInstance.get.mockRejectedValueOnce({ response: { status: 401 } });
      const adapter = new GitLabAdapter("glpat_test");
      await expect(adapter.addComment("1", "101", "comment")).rejects.toBeDefined();
    });
  });
});
