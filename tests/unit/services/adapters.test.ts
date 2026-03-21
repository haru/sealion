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
        status: "OPEN",
        priority: "MEDIUM",
      });
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

    it("maps closed state correctly", async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: { login: "testuser" } });
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: [{ number: 1, title: "Closed", state: "closed", html_url: "https://gh.com/1" }],
      });

      const issues = await adapter.fetchAssignedIssues("owner/repo");
      expect(issues[0].status).toBe("CLOSED");
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

  describe("closeIssue / reopenIssue", () => {
    it("patches issue state to closed", async () => {
      mockAxiosInstance.patch.mockResolvedValue({ data: {} });
      await adapter.closeIssue("owner/repo", "42");
      expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
        "/repos/owner/repo/issues/42",
        { state: "closed" }
      );
    });

    it("patches issue state to open", async () => {
      mockAxiosInstance.patch.mockResolvedValue({ data: {} });
      await adapter.reopenIssue("owner/repo", "42");
      expect(mockAxiosInstance.patch).toHaveBeenCalledWith(
        "/repos/owner/repo/issues/42",
        { state: "open" }
      );
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
      mockAxiosInstance.get.mockResolvedValue({
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
          total: 1,
        },
      });

      const issues = await adapter.fetchAssignedIssues("PROJ");
      expect(issues[0]).toMatchObject({
        externalId: "PROJ-1",
        title: "Fix login",
        status: "OPEN",
        priority: "HIGH",
      });
    });

    it("maps done status to CLOSED", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          issues: [
            {
              id: "1",
              key: "PROJ-1",
              fields: {
                summary: "Done issue",
                status: { statusCategory: { key: "done" } },
              },
            },
          ],
          total: 1,
        },
      });

      const issues = await adapter.fetchAssignedIssues("PROJ");
      expect(issues[0].status).toBe("CLOSED");
    });
  });

  describe("fetchUnassignedIssues", () => {
    it("fetches issues with JQL assignee is EMPTY and sets isUnassigned: true", async () => {
      mockAxiosInstance.get.mockResolvedValue({
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
          total: 1,
        },
      });

      const issues = await adapter.fetchUnassignedIssues("PROJ");
      expect(issues).toHaveLength(1);
      expect(issues[0].isUnassigned).toBe(true);
      expect(issues[0].externalId).toBe("PROJ-5");
    });

    it("passes correct JQL with assignee is EMPTY", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { issues: [], total: 0 } });

      await adapter.fetchUnassignedIssues("PROJ");

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/search",
        expect.objectContaining({
          params: expect.objectContaining({
            jql: expect.stringContaining("assignee is EMPTY"),
          }),
        })
      );
    });
  });

  describe("fetchAssignedIssues isUnassigned field", () => {
    it("sets isUnassigned: false on all returned issues", async () => {
      mockAxiosInstance.get.mockResolvedValue({
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
          total: 1,
        },
      });

      const issues = await adapter.fetchAssignedIssues("PROJ");
      expect(issues[0].isUnassigned).toBe(false);
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

  describe("reopenIssue", () => {
    it("applies new/to-do transition", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          transitions: [
            { id: "11", name: "To Do", to: { statusCategory: { key: "new" } } },
          ],
        },
      });
      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      await adapter.reopenIssue("PROJ", "PROJ-1");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/issue/PROJ-1/transitions",
        { transition: { id: "11" } }
      );
    });

    it("throws when no new transition exists", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { transitions: [{ id: "31", name: "Done", to: { statusCategory: { key: "done" } } }] },
      });

      await expect(adapter.reopenIssue("PROJ", "PROJ-1")).rejects.toThrow();
    });
  });

  describe("priority mapping", () => {
    const makePriorityIssue = (priorityName: string) => ({
      issues: [
        {
          id: "1",
          key: "PROJ-1",
          fields: {
            summary: "Test",
            status: { statusCategory: { key: "indeterminate" } },
            priority: { name: priorityName },
          },
        },
      ],
      total: 1,
    });

    it.each([
      ["Highest", "CRITICAL"],
      ["Critical", "CRITICAL"],
      ["High", "HIGH"],
      ["Low", "LOW"],
      ["Lowest", "LOW"],
      ["Trivial", "LOW"],
      ["Normal", "MEDIUM"],
    ])("maps Jira priority %s to %s", async (jiraPriority, expected) => {
      mockAxiosInstance.get.mockResolvedValue({ data: makePriorityIssue(jiraPriority) });
      const issues = await adapter.fetchAssignedIssues("PROJ");
      expect(issues[0].priority).toBe(expected);
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
        status: "OPEN",
        priority: "HIGH",
      });
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

  describe("reopenIssue", () => {
    it("applies open status", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          issue_statuses: [
            { id: 1, name: "New", is_closed: false },
            { id: 5, name: "Closed", is_closed: true },
          ],
        },
      });
      mockAxiosInstance.put.mockResolvedValue({ data: {} });

      await adapter.reopenIssue("my-project", "123");
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        "/issues/123.json",
        { issue: { status_id: 1 } }
      );
    });

    it("throws when no open status exists", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { issue_statuses: [{ id: 5, name: "Closed", is_closed: true }] },
      });

      await expect(adapter.reopenIssue("my-project", "123")).rejects.toThrow();
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

// Additional factory tests
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

  it("throws for unknown provider type", async () => {
    const { createAdapter } = await import("@/services/issue-provider/factory");
    expect(() => createAdapter("UNKNOWN" as never, {})).toThrow();
  });
});
