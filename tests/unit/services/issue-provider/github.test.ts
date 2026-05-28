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

import { GitHubAdapter } from "@/services/issue-provider/github/github";

function makeGitHubIssue(overrides: Record<string, unknown> = {}) {
  return {
    number: 1,
    title: "Test issue",
    state: "open",
    html_url: "https://github.com/owner/repo/issues/1",
    milestone: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    assignee: { login: "testuser" },
    pull_request: undefined,
    ...overrides,
  };
}

function makeSearchItem(overrides: Record<string, unknown> = {}) {
  return {
    number: 10,
    title: "PR review needed",
    state: "open",
    html_url: "https://github.com/owner/repo/pull/10",
    milestone: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    assignee: null,
    pull_request: { url: "https://api.github.com/repos/owner/repo/pulls/10" },
    ...overrides,
  };
}

describe("GitHubAdapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosInstance.get.mockReset();
    mockAxiosInstance.patch.mockReset();
    mockAxiosInstance.post.mockReset();
    mockAxiosInstance.put.mockReset();
  });

  describe("testConnection", () => {
    it("resolves when GET /user returns 200", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { login: "testuser" } });
      const adapter = new GitHubAdapter("ghp_test");
      await expect(adapter.testConnection()).resolves.toBeUndefined();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/user");
    });

    it("throws when GET /user returns 401", async () => {
      mockAxiosInstance.get.mockRejectedValue({ response: { status: 401 } });
      const adapter = new GitHubAdapter("ghp_bad");
      await expect(adapter.testConnection()).rejects.toBeDefined();
    });
  });

  describe("listProjects", () => {
    it("returns mapped repos for a single page", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: [
          { full_name: "owner/repo1" },
          { full_name: "owner/repo2" },
        ],
      });
      const adapter = new GitHubAdapter("ghp_test");
      const projects = await adapter.listProjects();
      expect(projects).toEqual([
        { externalId: "owner/repo1", displayName: "owner/repo1" },
        { externalId: "owner/repo2", displayName: "owner/repo2" },
      ]);
    });

    it("paginates when results fill the page", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: Array(100).fill({ full_name: "owner/repo" }) })
        .mockResolvedValueOnce({ data: [{ full_name: "owner/last" }] });
      const adapter = new GitHubAdapter("ghp_test");
      const projects = await adapter.listProjects();
      expect(projects).toHaveLength(101);
    });
  });

  describe("fetchAssignedIssues", () => {
    it("returns assignee-only issues (existing baseline)", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { login: "testuser" } })
        .mockResolvedValueOnce({
          data: [makeGitHubIssue({ number: 1, title: "Assigned issue" })],
        })
        .mockResolvedValueOnce({ data: { items: [] } });
      const adapter = new GitHubAdapter("ghp_test");
      const issues = await adapter.fetchAssignedIssues("owner/repo");
      expect(issues).toHaveLength(1);
      expect(issues[0].externalId).toBe("1");
      expect(issues[0].title).toBe("Assigned issue");
      expect(issues[0].isUnassigned).toBe(false);
    });

    it("fetches reviewer PRs via Search API", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { login: "testuser" } })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({
          data: {
            items: [makeSearchItem({ number: 42, title: "PR needs review" })],
          },
        });
      const adapter = new GitHubAdapter("ghp_test");
      const issues = await adapter.fetchAssignedIssues("owner/repo");
      expect(issues).toHaveLength(1);
      expect(issues[0].externalId).toBe("42");
      expect(issues[0].title).toBe("PR needs review");
      expect(issues[0].isUnassigned).toBe(false);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/search/issues", expect.objectContaining({
        params: expect.objectContaining({
          q: "is:pr is:open review-requested:testuser repo:owner/repo",
        }),
      }));
    });

    it("dedupes assignee + reviewer PR by externalId", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { login: "testuser" } })
        .mockResolvedValueOnce({
          data: [makeGitHubIssue({ number: 42, title: "Assigned PR" })],
        })
        .mockResolvedValueOnce({
          data: {
            items: [makeSearchItem({ number: 42, title: "Assigned PR" })],
          },
        });
      const adapter = new GitHubAdapter("ghp_test");
      const issues = await adapter.fetchAssignedIssues("owner/repo");
      expect(issues).toHaveLength(1);
      expect(issues[0].externalId).toBe("42");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/search/issues", expect.anything());
    });

    it("excludes team-reviewer-only PRs (FR-011)", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { login: "testuser" } })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({
          data: {
            items: [makeSearchItem({ number: 99, title: "Team review PR" })],
          },
        });
      const adapter = new GitHubAdapter("ghp_test");
      const issues = await adapter.fetchAssignedIssues("owner/repo");
      expect(issues).toHaveLength(1);
      expect(issues[0].externalId).toBe("99");
    });

    it("propagates Search API 422/403 errors (C-1.9)", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { login: "testuser" } })
        .mockResolvedValueOnce({ data: [] })
        .mockRejectedValueOnce({ response: { status: 422, data: { message: "Validation failed" } } });
      const adapter = new GitHubAdapter("ghp_test");
      await expect(adapter.fetchAssignedIssues("owner/repo")).rejects.toBeDefined();
    });

    it("propagates Search API 403 rate limit errors", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { login: "testuser" } })
        .mockResolvedValueOnce({ data: [] })
        .mockRejectedValueOnce({ response: { status: 403, data: { message: "Rate limit exceeded" } } });
      const adapter = new GitHubAdapter("ghp_test");
      await expect(adapter.fetchAssignedIssues("owner/repo")).rejects.toBeDefined();
    });
  });

  describe("fetchUnassignedIssues", () => {
    it("fetches unassigned issues with assignee=none", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: [makeGitHubIssue({ number: 5, title: "Unassigned", assignee: null })],
      });
      const adapter = new GitHubAdapter("ghp_test");
      const issues = await adapter.fetchUnassignedIssues("owner/repo");
      expect(issues).toHaveLength(1);
      expect(issues[0].isUnassigned).toBe(true);
      expect(issues[0].externalId).toBe("5");
    });
  });

  describe("closeIssue", () => {
    it("closes issue via PATCH", async () => {
      mockAxiosInstance.patch.mockResolvedValue({});
      const adapter = new GitHubAdapter("ghp_test");
      await adapter.closeIssue("owner/repo", "42");
      expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
        "/repos/owner/repo/issues/42",
        { state: "closed" },
      );
    });
  });

  describe("addComment", () => {
    it("posts comment via POST", async () => {
      mockAxiosInstance.post.mockResolvedValue({});
      const adapter = new GitHubAdapter("ghp_test");
      await adapter.addComment("owner/repo", "42", "LGTM");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/repos/owner/repo/issues/42/comments",
        { body: "LGTM" },
      );
    });
  });
});
