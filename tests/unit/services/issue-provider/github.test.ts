/**
 * Unit tests for the GitHubAdapter — connection, CRUD, pagination, baseUrl, reviewer PR fetching.
 * @jest-environment node
 */

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

    it("throws when listProjects exceeds MAX_PAGES", async () => {
      for (let i = 0; i < 20; i++) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          data: Array(100).fill({ full_name: "owner/repo" }),
        });
      }
      const adapter = new GitHubAdapter("ghp_test");
      await expect(adapter.listProjects()).rejects.toThrow("MAX_PAGES");
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

    it("throws on invalid projectExternalId (no slash) — C-1", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { login: "testuser" } });
      const adapter = new GitHubAdapter("ghp_test");
      await expect(adapter.fetchAssignedIssues("invalid")).rejects.toThrow("Invalid GitHub project ID");
    });

    it("throws on invalid projectExternalId (empty repo segment) — C-1", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { login: "testuser" } });
      const adapter = new GitHubAdapter("ghp_test");
      await expect(adapter.fetchAssignedIssues("owner/")).rejects.toThrow("Invalid GitHub project ID");
    });

    it("throws on invalid projectExternalId (empty owner segment) — T-4", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { login: "testuser" } });
      const adapter = new GitHubAdapter("ghp_test");
      await expect(adapter.fetchAssignedIssues("/repo")).rejects.toThrow("Invalid GitHub project ID");
    });

    it("throws on invalid projectExternalId (too many segments) — C-1", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { login: "testuser" } });
      const adapter = new GitHubAdapter("ghp_test");
      await expect(adapter.fetchAssignedIssues("owner/repo/extra")).rejects.toThrow("Invalid GitHub project ID");
    });

    it("maps milestone.due_on to dueDate — T-6", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { login: "testuser" } })
        .mockResolvedValueOnce({ data: [makeGitHubIssue({ number: 1, milestone: { due_on: "2026-12-31T00:00:00Z" } })] })
        .mockResolvedValueOnce({ data: { items: [] } });
      const adapter = new GitHubAdapter("ghp_test");
      const issues = await adapter.fetchAssignedIssues("owner/repo");
      expect(issues[0].dueDate).toEqual(new Date("2026-12-31T00:00:00Z"));
    });

    it("sets dueDate to null when milestone is absent — T-6", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { login: "testuser" } })
        .mockResolvedValueOnce({ data: [makeGitHubIssue({ number: 1, milestone: null })] })
        .mockResolvedValueOnce({ data: { items: [] } });
      const adapter = new GitHubAdapter("ghp_test");
      const issues = await adapter.fetchAssignedIssues("owner/repo");
      expect(issues[0].dueDate).toBeNull();
    });

    it("throws when fetchReviewerPrs exceeds MAX_PAGES (I-11)", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { login: "testuser" } });
      // assigned issues: empty (returns in 1 call)
      mockAxiosInstance.get.mockResolvedValueOnce({ data: [] });
      // reviewer PRs: 20 full pages then fails
      for (let i = 0; i < 20; i++) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          data: { items: Array(100).fill(makeSearchItem()) },
        });
      }
      const adapter = new GitHubAdapter("ghp_test");
      await expect(adapter.fetchAssignedIssues("owner/repo")).rejects.toThrow("MAX_PAGES");
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

    it("throws when fetchUnassignedIssues exceeds MAX_PAGES", async () => {
      for (let i = 0; i < 20; i++) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          data: Array(100).fill(makeGitHubIssue({ assignee: null })),
        });
      }
      const adapter = new GitHubAdapter("ghp_test");
      await expect(adapter.fetchUnassignedIssues("owner/repo")).rejects.toThrow("MAX_PAGES");
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

    it("throws when PATCH returns non-2xx status", async () => {
      const axiosError = Object.assign(new Error("Request failed with status code 403"), {
        isAxiosError: true,
        response: { status: 403, data: { message: "Forbidden" } },
      });
      mockAxiosInstance.patch.mockRejectedValue(axiosError);
      const adapter = new GitHubAdapter("ghp_test");
      await expect(adapter.closeIssue("owner/repo", "42")).rejects.toThrow();
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

    it("throws when POST returns non-2xx status", async () => {
      const axiosError = Object.assign(new Error("Request failed with status code 403"), {
        isAxiosError: true,
        response: { status: 403, data: { message: "Forbidden" } },
      });
      mockAxiosInstance.post.mockRejectedValue(axiosError);
      const adapter = new GitHubAdapter("ghp_test");
      await expect(adapter.addComment("owner/repo", "42", "LGTM")).rejects.toThrow();
    });
  });

  describe("getLogin — caching behaviour", () => {
    it("clears cached rejected promise so a second fetchAssignedIssues call can succeed — T-5", async () => {
      const error = new Error("Network error");
      // First call: getLogin rejects (simulating a real network failure)
      mockAxiosInstance.get.mockRejectedValueOnce(error);
      const adapter = new GitHubAdapter("ghp_test");

      await expect(adapter.fetchAssignedIssues("owner/repo")).rejects.toThrow("Network error");

      // Clear call history, then set up for success on the second attempt
      mockAxiosInstance.get.mockClear();
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { login: "testuser" } }) // getLogin retry
        .mockResolvedValueOnce({ data: [] })                    // assigned issues
        .mockResolvedValueOnce({ data: { items: [] } });        // reviewer prs

      await expect(adapter.fetchAssignedIssues("owner/repo")).resolves.toEqual([]);
      // Verify that /user was called again (cache was cleared, not reused)
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(1, "/user");
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
    });

    it("caches resolved login so a second fetchAssignedIssues call does not re-request /user — T-5", async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { login: "testuser" } }) // getLogin (1st call)
        .mockResolvedValueOnce({ data: [] })                    // assigned issues (1st)
        .mockResolvedValueOnce({ data: { items: [] } })         // reviewer prs (1st)
        .mockResolvedValueOnce({ data: [] })                    // assigned issues (2nd)
        .mockResolvedValueOnce({ data: { items: [] } });        // reviewer prs (2nd)
      const adapter = new GitHubAdapter("ghp_test");
      await adapter.fetchAssignedIssues("owner/repo");
      await adapter.fetchAssignedIssues("owner/repo");
      // /user is called only once; subsequent calls use the cached promise
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(5);
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(1, "/user");
    });
  });
});

describe("GitHubAdapter — baseUrl resolution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);
  });

  it("uses https://api.github.com when no baseUrl is provided", () => {
    new GitHubAdapter("ghp_test");
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: "https://api.github.com" }),
    );
  });

  it("uses ${baseUrl}/api/v3 when baseUrl is provided", () => {
    new GitHubAdapter("ghp_test", "https://github.example.com");
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: "https://github.example.com/api/v3" }),
    );
  });

  it("strips trailing slash from baseUrl before appending /api/v3", () => {
    new GitHubAdapter("ghp_test", "https://github.example.com/");
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: "https://github.example.com/api/v3" }),
    );
  });

  it("uses https://api.github.com when baseUrl is null", () => {
    new GitHubAdapter("ghp_test", null);
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: "https://api.github.com" }),
    );
  });

  it("calls GET /user/repos using correct path when constructed with GHE baseUrl — T-7", async () => {
    (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);
    const adapter = new GitHubAdapter("ghp_test", "https://github.example.com");
    mockAxiosInstance.get.mockResolvedValue({ data: [{ full_name: "org/repo" }] });
    const projects = await adapter.listProjects();
    expect(projects).toEqual([{ externalId: "org/repo", displayName: "org/repo" }]);
    expect(mockAxiosInstance.get).toHaveBeenCalledWith(
      "/user/repos",
      expect.objectContaining({ params: expect.objectContaining({ per_page: 100, page: 1 }) }),
    );
  });
});
