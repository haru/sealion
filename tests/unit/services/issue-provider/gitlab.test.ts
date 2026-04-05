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
        });
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
        });
      const adapter = new GitLabAdapter("glpat_test");
      const issues = await adapter.fetchAssignedIssues("1");
      expect(issues).toHaveLength(2);
    });

    it("returns empty array when no assigned issues", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { id: 42 } })
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
        .mockResolvedValueOnce({
          data: [{ id: 102, iid: 2, title: "B", web_url: "https://y", due_date: null, assignees: [{ id: 42 }], created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }],
          headers: {},
        });
      const adapter = new GitLabAdapter("glpat_test");
      await adapter.fetchAssignedIssues("1");
      await adapter.fetchAssignedIssues("1");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/user");
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
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
