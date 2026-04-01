/** @jest-environment node */
import { GitHubAdapter } from "@/services/issue-provider/github";
import { JiraAdapter } from "@/services/issue-provider/jira";
import { RedmineAdapter } from "@/services/issue-provider/redmine";

// Mock axios
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

describe("GitHubAdapter", () => {
  let adapter: GitHubAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new GitHubAdapter("test-token");
  });

  describe("testConnection", () => {
    it("calls GET /user", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: {} });
      await adapter.testConnection();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/user");
    });

    it("propagates error when connection fails", async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error("401 Unauthorized"));
      await expect(adapter.testConnection()).rejects.toThrow();
    });
  });

  describe("listProjects", () => {
    it("returns repos as projects", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: [
          { full_name: "owner/repo1" },
          { full_name: "owner/repo2" },
        ],
      });

      const projects = await adapter.listProjects();
      expect(projects).toHaveLength(2);
      expect(projects[0]).toEqual({ externalId: "owner/repo1", displayName: "owner/repo1" });
    });

    it("paginates when result has 100 items", async () => {
      const page1 = Array.from({ length: 100 }, (_, i) => ({ full_name: `owner/repo${i}` }));
      const page2 = [{ full_name: "owner/repo100" }];
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: page1 })
        .mockResolvedValueOnce({ data: page2 });

      const projects = await adapter.listProjects();
      expect(projects).toHaveLength(101);
    });
  });

  describe("fetchAssignedIssues", () => {
    it("normalizes GitHub issues", async () => {
      // First call: GET /user to resolve login
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { login: "testuser" } });
      // Second call: GET /repos/owner/repo/issues
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: [
          {
            number: 42,
            title: "Fix bug",
            state: "open",
            html_url: "https://github.com/owner/repo/issues/42",
            milestone: { due_on: "2026-04-01T00:00:00Z" },
          },
        ],
      });

      const issues = await adapter.fetchAssignedIssues("owner/repo");
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        externalId: "42",
        title: "Fix bug",
      });
      expect(issues[0]).not.toHaveProperty("priority");
      expect(issues[0]).not.toHaveProperty("status");
      expect(issues[0].dueDate).toBeInstanceOf(Date);
    });

    it("uses authenticated user login as assignee filter", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { login: "myuser" } });
      mockAxiosInstance.get.mockResolvedValueOnce({ data: [] });

      await adapter.fetchAssignedIssues("owner/repo");

      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(
        2,
        "/repos/owner/repo/issues",
        expect.objectContaining({ params: expect.objectContaining({ assignee: "myuser" }) })
      );
    });

    it("caches the login and does not call /user twice", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { login: "myuser" } });
      mockAxiosInstance.get.mockResolvedValue({ data: [] });

      await adapter.fetchAssignedIssues("owner/repo1");
      await adapter.fetchAssignedIssues("owner/repo2");

      const userCalls = (mockAxiosInstance.get as jest.Mock).mock.calls.filter(
        ([url]: [string]) => url === "/user"
      );
      expect(userCalls).toHaveLength(1);
    });

  });

  describe("fetchUnassignedIssues", () => {
    it("fetches issues with assignee=none and sets isUnassigned: true", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: [
          {
            number: 99,
            title: "Unassigned bug",
            state: "open",
            html_url: "https://github.com/owner/repo/issues/99",
          },
        ],
      });

      const issues = await adapter.fetchUnassignedIssues("owner/repo");
      expect(issues).toHaveLength(1);
      expect(issues[0].isUnassigned).toBe(true);
      expect(issues[0].externalId).toBe("99");
    });

    it("passes assignee=none param to the API", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: [] });

      await adapter.fetchUnassignedIssues("owner/repo");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/repos/owner/repo/issues",
        expect.objectContaining({ params: expect.objectContaining({ assignee: "none" }) })
      );
    });
  });

  describe("fetchAssignedIssues isUnassigned field", () => {
    it("sets isUnassigned: false on all returned issues", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { login: "testuser" } });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: [{ number: 1, title: "My issue", state: "open", html_url: "https://github.com/owner/repo/issues/1" }],
      });

      const issues = await adapter.fetchAssignedIssues("owner/repo");
      expect(issues[0].isUnassigned).toBe(false);
    });
  });

  describe("provider timestamps", () => {
    it("maps created_at and updated_at to providerCreatedAt/providerUpdatedAt as Date", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { login: "testuser" } });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: [
          {
            number: 42,
            title: "Fix bug",
            state: "open",
            html_url: "https://github.com/owner/repo/issues/42",
            created_at: "2026-01-15T10:00:00Z",
            updated_at: "2026-03-10T14:30:00Z",
          },
        ],
      });

      const issues = await adapter.fetchAssignedIssues("owner/repo");
      expect(issues[0].providerCreatedAt).toEqual(new Date("2026-01-15T10:00:00Z"));
      expect(issues[0].providerUpdatedAt).toEqual(new Date("2026-03-10T14:30:00Z"));
    });

    it("maps created_at and updated_at in fetchUnassignedIssues as Date", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: [
          {
            number: 99,
            title: "Unassigned bug",
            state: "open",
            html_url: "https://github.com/owner/repo/issues/99",
            created_at: "2026-02-01T08:00:00Z",
            updated_at: "2026-03-15T12:00:00Z",
          },
        ],
      });

      const issues = await adapter.fetchUnassignedIssues("owner/repo");
      expect(issues[0].providerCreatedAt).toEqual(new Date("2026-02-01T08:00:00Z"));
      expect(issues[0].providerUpdatedAt).toEqual(new Date("2026-03-15T12:00:00Z"));
    });
  });

  describe("closeIssue", () => {
    it("patches issue state to closed", async () => {
      mockAxiosInstance.patch.mockResolvedValue({ data: {} });
      await adapter.closeIssue("owner/repo", "42");
      expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
        "/repos/owner/repo/issues/42",
        { state: "closed" }
      );
    });
  });

  describe("addComment", () => {
    it("posts comment to GitHub issues endpoint", async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { id: 1 } });
      await adapter.addComment("owner/repo", "42", "This is a comment");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/repos/owner/repo/issues/42/comments",
        { body: "This is a comment" }
      );
    });

    it("propagates error when comment posting fails", async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error("403 Forbidden"));
      await expect(adapter.addComment("owner/repo", "42", "comment")).rejects.toThrow();
    });
  });
});

describe("JiraAdapter", () => {
  let adapter: JiraAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new JiraAdapter("https://example.atlassian.net", "user@ex.com", "api-token");
  });

  describe("testConnection", () => {
    it("calls GET /myself", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: {} });
      await adapter.testConnection();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/myself");
    });
  });

  describe("listProjects", () => {
    it("returns projects", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: [{ id: "1", key: "PROJ", name: "My Project" }],
      });

      const projects = await adapter.listProjects();
      expect(projects[0]).toMatchObject({ externalId: "PROJ" });
    });
  });

  describe("fetchAssignedIssues", () => {
    it("normalizes Jira issues", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          issues: [
            {
              id: "10001",
              key: "PROJ-1",
              fields: {
                summary: "Fix login",
                status: { statusCategory: { key: "indeterminate" } },
                priority: { name: "High" },
                duedate: "2026-04-01",
              },
            },
          ],
        },
      });

      const issues = await adapter.fetchAssignedIssues("PROJ");
      expect(issues[0]).toMatchObject({
        externalId: "PROJ-1",
        title: "Fix login",
      });
      expect(issues[0]).not.toHaveProperty("priority");
      expect(issues[0]).not.toHaveProperty("status");
    });

  });

  describe("fetchUnassignedIssues", () => {
    it("fetches issues with JQL assignee is EMPTY and sets isUnassigned: true", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          issues: [
            {
              id: "20001",
              key: "PROJ-5",
              fields: {
                summary: "Unassigned task",
                status: { statusCategory: { key: "indeterminate" } },
              },
            },
          ],
        },
      });

      const issues = await adapter.fetchUnassignedIssues("PROJ");
      expect(issues).toHaveLength(1);
      expect(issues[0].isUnassigned).toBe(true);
      expect(issues[0].externalId).toBe("PROJ-5");
    });

    it("passes correct JQL with assignee is EMPTY", async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { issues: [] } });

      await adapter.fetchUnassignedIssues("PROJ");

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/search/jql",
        expect.objectContaining({
          jql: expect.stringContaining("assignee is EMPTY"),
        })
      );
    });
  });

  describe("fetchAssignedIssues isUnassigned field", () => {
    it("sets isUnassigned: false on all returned issues", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          issues: [
            {
              id: "10001",
              key: "PROJ-1",
              fields: {
                summary: "My issue",
                status: { statusCategory: { key: "indeterminate" } },
              },
            },
          ],
        },
      });

      const issues = await adapter.fetchAssignedIssues("PROJ");
      expect(issues[0].isUnassigned).toBe(false);
    });
  });

  describe("provider timestamps", () => {
    it("returns providerCreatedAt and providerUpdatedAt as Date when fields.created and fields.updated are present", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          issues: [
            {
              id: "10001",
              key: "PROJ-1",
              fields: {
                summary: "Fix login",
                status: { statusCategory: { key: "indeterminate" } },
                created: "2026-01-15T10:00:00.000+0900",
                updated: "2026-03-10T14:30:00.000+0900",
              },
            },
          ],
        },
      });

      const issues = await adapter.fetchAssignedIssues("PROJ");
      expect(issues[0].providerCreatedAt).toEqual(new Date("2026-01-15T10:00:00.000+0900"));
      expect(issues[0].providerUpdatedAt).toEqual(new Date("2026-03-10T14:30:00.000+0900"));
    });

    it("returns providerCreatedAt and providerUpdatedAt as null when fields.created/updated are absent", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          issues: [
            {
              id: "10001",
              key: "PROJ-1",
              fields: {
                summary: "No timestamps",
                status: { statusCategory: { key: "indeterminate" } },
              },
            },
          ],
        },
      });

      const issues = await adapter.fetchAssignedIssues("PROJ");
      expect(issues[0].providerCreatedAt).toBeNull();
      expect(issues[0].providerUpdatedAt).toBeNull();
    });
  });

  describe("closeIssue", () => {
    it("applies done transition", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          transitions: [
            { id: "31", name: "Done", to: { statusCategory: { key: "done" } } },
          ],
        },
      });
      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      await adapter.closeIssue("PROJ", "PROJ-1");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/issue/PROJ-1/transitions",
        { transition: { id: "31" } }
      );
    });

    it("throws when no done transition exists", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { transitions: [] },
      });

      await expect(adapter.closeIssue("PROJ", "PROJ-1")).rejects.toThrow();
    });
  });

  describe("addComment", () => {
    it("posts comment to Jira issue comment endpoint using ADF format", async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: {} });
      await adapter.addComment("PROJ", "PROJ-1", "Completed after review.");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/issue/PROJ-1/comment",
        {
          body: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Completed after review." }],
              },
            ],
          },
        }
      );
    });

    it("propagates error when comment posting fails", async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error("500 Server Error"));
      await expect(adapter.addComment("PROJ", "PROJ-1", "comment")).rejects.toThrow();
    });
  });

});


describe("RedmineAdapter", () => {
  let adapter: RedmineAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new RedmineAdapter("https://redmine.example.com", "test-api-key");
  });

  describe("testConnection", () => {
    it("calls GET /users/current.json", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: {} });
      await adapter.testConnection();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/users/current.json");
    });
  });

  describe("fetchUnassignedIssues", () => {
    it("fetches open issues without assigned_to and sets isUnassigned: true", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          issues: [
            {
              id: 201,
              subject: "Unassigned task",
              status: { id: 1, name: "New", is_closed: false },
              // no assigned_to field
            },
            {
              id: 202,
              subject: "Assigned task",
              status: { id: 1, name: "New", is_closed: false },
              assigned_to: { id: 5, name: "Alice" },
            },
          ],
          total_count: 2,
        },
      });

      const issues = await adapter.fetchUnassignedIssues("my-project");
      expect(issues).toHaveLength(1);
      expect(issues[0].externalId).toBe("201");
      expect(issues[0].isUnassigned).toBe(true);
    });

    it("passes status_id=open to the API", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { issues: [], total_count: 0 } });

      await adapter.fetchUnassignedIssues("my-project");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/issues.json",
        expect.objectContaining({ params: expect.objectContaining({ status_id: "open" }) })
      );
    });

    it("paginates across multiple pages and returns only unassigned issues", async () => {
      // Page 1: 100 issues, 50 unassigned + 50 assigned; total_count = 150
      const page1Issues = [
        ...Array.from({ length: 50 }, (_, i) => ({
          id: i + 1,
          subject: `Unassigned ${i + 1}`,
          status: { id: 1, name: "New", is_closed: false },
        })),
        ...Array.from({ length: 50 }, (_, i) => ({
          id: i + 51,
          subject: `Assigned ${i + 51}`,
          status: { id: 1, name: "New", is_closed: false },
          assigned_to: { id: 1, name: "Alice" },
        })),
      ];
      // Page 2: 50 issues, all unassigned
      const page2Issues = Array.from({ length: 50 }, (_, i) => ({
        id: i + 101,
        subject: `Unassigned page2 ${i + 101}`,
        status: { id: 1, name: "New", is_closed: false },
      }));

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { issues: page1Issues, total_count: 150 } })
        .mockResolvedValueOnce({ data: { issues: page2Issues, total_count: 150 } });

      const issues = await adapter.fetchUnassignedIssues("my-project");

      // 50 unassigned from page 1 + 50 from page 2 = 100
      expect(issues).toHaveLength(100);
      expect(issues.every((i) => i.isUnassigned)).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(
        2,
        "/issues.json",
        expect.objectContaining({ params: expect.objectContaining({ offset: 100 }) })
      );
    });
  });

  describe("fetchAssignedIssues isUnassigned field", () => {
    it("sets isUnassigned: false on all returned issues", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          issues: [
            {
              id: 123,
              subject: "Fix server",
              status: { id: 1, name: "New", is_closed: false },
              assigned_to: { id: 1, name: "Me" },
            },
          ],
          total_count: 1,
        },
      });

      const issues = await adapter.fetchAssignedIssues("my-project");
      expect(issues[0].isUnassigned).toBe(false);
    });
  });

  describe("provider timestamps", () => {
    it("returns providerCreatedAt and providerUpdatedAt as Date when created_on/updated_on are present", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          issues: [
            {
              id: 123,
              subject: "Fix server",
              status: { id: 1, name: "New", is_closed: false },
              created_on: "2026-01-15 10:00:00 +0000",
              updated_on: "2026-03-10 14:30:00 +0000",
            },
          ],
          total_count: 1,
        },
      });

      const issues = await adapter.fetchAssignedIssues("my-project");
      expect(issues[0].providerCreatedAt).toEqual(new Date("2026-01-15 10:00:00 +0000"));
      expect(issues[0].providerUpdatedAt).toEqual(new Date("2026-03-10 14:30:00 +0000"));
    });

    it("returns providerCreatedAt and providerUpdatedAt as null when created_on/updated_on are absent", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          issues: [
            {
              id: 124,
              subject: "No timestamps",
              status: { id: 1, name: "New", is_closed: false },
            },
          ],
          total_count: 1,
        },
      });

      const issues = await adapter.fetchAssignedIssues("my-project");
      expect(issues[0].providerCreatedAt).toBeNull();
      expect(issues[0].providerUpdatedAt).toBeNull();
    });
  });

  describe("fetchAssignedIssues", () => {
    it("normalizes Redmine issues", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          issues: [
            {
              id: 123,
              subject: "Fix server",
              status: { id: 1, name: "New", is_closed: false },
              priority: { id: 2, name: "High" },
              due_date: "2026-04-01",
            },
          ],
          total_count: 1,
        },
      });

      const issues = await adapter.fetchAssignedIssues("my-project");
      expect(issues[0]).toMatchObject({
        externalId: "123",
        title: "Fix server",
      });
      expect(issues[0]).not.toHaveProperty("priority");
      expect(issues[0]).not.toHaveProperty("status");
    });
  });

  describe("closeIssue", () => {
    it("applies closed status", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          issue_statuses: [
            { id: 1, name: "New", is_closed: false },
            { id: 5, name: "Closed", is_closed: true },
          ],
        },
      });
      mockAxiosInstance.put.mockResolvedValue({ data: {} });

      await adapter.closeIssue("my-project", "123");
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        "/issues/123.json",
        { issue: { status_id: 5 } }
      );
    });

    it("throws when no closed status exists", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { issue_statuses: [{ id: 1, name: "New", is_closed: false }] },
      });

      await expect(adapter.closeIssue("my-project", "123")).rejects.toThrow();
    });
  });

  describe("addComment", () => {
    it("puts comment via notes field to Redmine issue endpoint", async () => {
      mockAxiosInstance.put.mockResolvedValue({ data: {} });
      await adapter.addComment("my-project", "123", "Resolved by PR #45.");
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        "/issues/123.json",
        { issue: { notes: "Resolved by PR #45." } }
      );
    });

    it("propagates error when comment posting fails", async () => {
      mockAxiosInstance.put.mockRejectedValue(new Error("422 Unprocessable Entity"));
      await expect(adapter.addComment("my-project", "123", "comment")).rejects.toThrow();
    });
  });

  describe("listProjects", () => {
    it("returns all projects", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          projects: [
            { id: 1, identifier: "proj-a", name: "Project A" },
            { id: 2, identifier: "proj-b", name: "Project B" },
          ],
        },
      });

      const projects = await adapter.listProjects();
      expect(projects).toHaveLength(2);
      expect(projects[0]).toMatchObject({ externalId: "proj-a", displayName: "Project A" });
    });
  });
});

// ---------------------------------------------------------------------------
// Proxy agent injection tests (T004)
// ---------------------------------------------------------------------------

describe("proxy agent injection — adapters receive httpAgent/httpsAgent when https_proxy is set", () => {
  let savedProxy: string | undefined;

  beforeEach(() => {
    savedProxy = process.env.https_proxy;
    process.env.https_proxy = "http://proxy.example.com:8080";
    jest.clearAllMocks();
    (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);
  });

  afterEach(() => {
    if (savedProxy === undefined) delete process.env.https_proxy;
    else process.env.https_proxy = savedProxy;
  });

  it("GitHubAdapter passes httpAgent and httpsAgent to axios.create when https_proxy is set", () => {
    new GitHubAdapter("token");
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({ httpAgent: expect.anything(), httpsAgent: expect.anything() })
    );
  });

  it("JiraAdapter passes httpAgent and httpsAgent to axios.create when https_proxy is set", () => {
    new JiraAdapter("https://example.atlassian.net", "user@ex.com", "api-token");
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({ httpAgent: expect.anything(), httpsAgent: expect.anything() })
    );
  });

  it("RedmineAdapter passes httpAgent and httpsAgent to axios.create when https_proxy is set", () => {
    new RedmineAdapter("https://redmine.example.com", "key");
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({ httpAgent: expect.anything(), httpsAgent: expect.anything() })
    );
  });
});

describe("proxy agent injection — adapters receive httpAgent/httpsAgent when only http_proxy is set (HTTP targets)", () => {
  const proxyEnvKeys = ["https_proxy", "HTTPS_PROXY", "http_proxy", "HTTP_PROXY"] as const;
  const originalProxyEnv: Partial<NodeJS.ProcessEnv> = {};

  beforeEach(() => {
    proxyEnvKeys.forEach((key) => {
      originalProxyEnv[key] = process.env[key];
      delete process.env[key];
    });
    process.env.http_proxy = "http://proxy.example.com:8080";
    jest.clearAllMocks();
    (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);
  });

  afterEach(() => {
    proxyEnvKeys.forEach((key) => {
      const value = originalProxyEnv[key];
      if (typeof value === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  });

  it("RedmineAdapter passes httpAgent and httpsAgent when only http_proxy is set and base URL is HTTP", () => {
    new RedmineAdapter("http://redmine.internal.com", "key");
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({ httpAgent: expect.anything(), httpsAgent: expect.anything() })
    );
  });
});

describe("proxy agent injection — adapters do NOT pass agents when no proxy env vars set", () => {
  const proxyEnvKeys = ["https_proxy", "HTTPS_PROXY", "http_proxy", "HTTP_PROXY"] as const;
  const originalProxyEnv: Partial<NodeJS.ProcessEnv> = {};

  beforeEach(() => {
    proxyEnvKeys.forEach((key) => {
      originalProxyEnv[key] = process.env[key];
      delete process.env[key];
    });
    jest.clearAllMocks();
    (axios.create as jest.Mock).mockReturnValue(mockAxiosInstance);
  });

  afterEach(() => {
    proxyEnvKeys.forEach((key) => {
      const value = originalProxyEnv[key];
      if (typeof value === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  });

  it("GitHubAdapter does not pass httpAgent/httpsAgent when no proxy env vars set", () => {
    new GitHubAdapter("token");
    const call = (axios.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(call).not.toHaveProperty("httpAgent");
    expect(call).not.toHaveProperty("httpsAgent");
  });

  it("JiraAdapter does not pass httpAgent/httpsAgent when no proxy env vars set", () => {
    new JiraAdapter("https://example.atlassian.net", "user@ex.com", "api-token");
    const call = (axios.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(call).not.toHaveProperty("httpAgent");
    expect(call).not.toHaveProperty("httpsAgent");
  });

  it("RedmineAdapter does not pass httpAgent/httpsAgent when no proxy env vars set", () => {
    new RedmineAdapter("https://redmine.example.com", "key");
    const call = (axios.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(call).not.toHaveProperty("httpAgent");
    expect(call).not.toHaveProperty("httpsAgent");
  });
});

// ---------------------------------------------------------------------------
// Additional factory tests
// ---------------------------------------------------------------------------

describe("createAdapter factory", () => {
  it("creates GitHubAdapter for GITHUB type", async () => {
    const { createAdapter } = await import("@/services/issue-provider/factory");
    const adapter = createAdapter("GITHUB" as never, { token: "test" });
    expect(adapter).toBeDefined();
  });

  it("creates JiraAdapter for JIRA type", async () => {
    const { createAdapter } = await import("@/services/issue-provider/factory");
    const adapter = createAdapter("JIRA" as never, {
      baseUrl: "https://test.atlassian.net",
      email: "test@test.com",
      apiToken: "token",
    });
    expect(adapter).toBeDefined();
  });

  it("creates RedmineAdapter for REDMINE type", async () => {
    const { createAdapter } = await import("@/services/issue-provider/factory");
    const adapter = createAdapter("REDMINE" as never, {
      baseUrl: "https://redmine.test.com",
      apiKey: "key",
    });
    expect(adapter).toBeDefined();
  });

  it("creates GitLabAdapter for GITLAB type", async () => {
    const { createAdapter } = await import("@/services/issue-provider/factory");
    const adapter = createAdapter("GITLAB" as never, { token: "test" }, "https://gitlab.example.com");
    expect(adapter).toBeDefined();
  });

  it("creates GitLabAdapter with default baseUrl when not provided", async () => {
    const { createAdapter } = await import("@/services/issue-provider/factory");
    const adapter = createAdapter("GITLAB" as never, { token: "test" });
    expect(adapter).toBeDefined();
  });

  it("throws for unknown provider type", async () => {
    const { createAdapter } = await import("@/services/issue-provider/factory");
    expect(() => createAdapter("UNKNOWN" as never, {})).toThrow();
  });
});
