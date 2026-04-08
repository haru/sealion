/** @jest-environment node */

jest.mock("axios", () => ({
  create: jest.fn().mockReturnValue({
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
  }),
}));

import axios from "axios";

const mockGet = jest.fn();
const mockPut = jest.fn();
const mockPost = jest.fn();

(axios.create as jest.Mock).mockReturnValue({
  get: mockGet,
  put: mockPut,
  post: mockPost,
});

import { AsanaAdapter } from "@/services/issue-provider/asana/asana";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTaskListResponse(
  tasks: {
    gid: string;
    name: string;
    due_on?: string | null;
    permalink_url: string;
    assignee: { gid: string } | null;
    created_at: string;
    modified_at: string;
  }[],
  nextPageOffset?: string,
) {
  return {
    data: {
      data: tasks,
      next_page: nextPageOffset ? { offset: nextPageOffset } : null,
    },
  };
}

function makeWorkspaceListResponse(workspaces: { gid: string; name: string }[], nextPageOffset?: string) {
  return {
    data: {
      data: workspaces,
      next_page: nextPageOffset ? { offset: nextPageOffset } : null,
    },
  };
}

function makeProjectListResponse(projects: { gid: string; name: string }[], nextPageOffset?: string) {
  return {
    data: {
      data: projects,
      next_page: nextPageOffset ? { offset: nextPageOffset } : null,
    },
  };
}

const SAMPLE_TASK = {
  gid: "task-1",
  name: "Fix the bug",
  due_on: "2026-04-15",
  permalink_url: "https://app.asana.com/0/project-1/task-1",
  assignee: { gid: "user-1" },
  created_at: "2026-04-01T00:00:00.000Z",
  modified_at: "2026-04-02T00:00:00.000Z",
};

const UNASSIGNED_TASK = {
  gid: "task-2",
  name: "Unassigned task",
  due_on: null,
  permalink_url: "https://app.asana.com/0/project-1/task-2",
  assignee: null,
  created_at: "2026-04-01T00:00:00.000Z",
  modified_at: "2026-04-01T00:00:00.000Z",
};

describe("AsanaAdapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── constructor ────────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("creates an axios client with the Asana base URL", () => {
      new AsanaAdapter("my-token");
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: "https://app.asana.com/api/1.0",
        }),
      );
    });

    it("sets Authorization: Bearer header", () => {
      new AsanaAdapter("my-token");
      const call = (axios.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      const headers = call.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer my-token");
    });
  });

  // ─── testConnection ────────────────────────────────────────────────────────

  describe("testConnection", () => {
    it("resolves when GET /users/me returns 200", async () => {
      mockGet.mockResolvedValue({ data: { data: { gid: "user-1", name: "Test User" } } });
      const adapter = new AsanaAdapter("valid-token");
      await expect(adapter.testConnection()).resolves.toBeUndefined();
      expect(mockGet).toHaveBeenCalledWith("/users/me");
    });

    it("throws when GET /users/me returns 401", async () => {
      mockGet.mockRejectedValue(Object.assign(new Error("Unauthorized"), { response: { status: 401 } }));
      const adapter = new AsanaAdapter("bad-token");
      await expect(adapter.testConnection()).rejects.toThrow();
    });

    it("throws on network error", async () => {
      mockGet.mockRejectedValue(new Error("Network error"));
      const adapter = new AsanaAdapter("valid-token");
      await expect(adapter.testConnection()).rejects.toThrow("Network error");
    });
  });

  // ─── listProjects ──────────────────────────────────────────────────────────

  describe("listProjects", () => {
    it("returns projects for a single workspace", async () => {
      mockGet
        .mockResolvedValueOnce(makeWorkspaceListResponse([{ gid: "ws-1", name: "My Workspace" }]))
        .mockResolvedValueOnce(makeProjectListResponse([
          { gid: "proj-1", name: "Project Alpha" },
          { gid: "proj-2", name: "Project Beta" },
        ]));

      const adapter = new AsanaAdapter("valid-token");
      const projects = await adapter.listProjects();

      expect(projects).toEqual([
        { externalId: "proj-1", displayName: "Project Alpha" },
        { externalId: "proj-2", displayName: "Project Beta" },
      ]);
      expect(mockGet).toHaveBeenCalledWith("/workspaces", expect.any(Object));
      expect(mockGet).toHaveBeenCalledWith(
        "/projects",
        expect.objectContaining({ params: expect.objectContaining({ workspace: "ws-1" }) }),
      );
    });

    it("aggregates projects from multiple workspaces", async () => {
      mockGet
        .mockResolvedValueOnce(makeWorkspaceListResponse([
          { gid: "ws-1", name: "Workspace One" },
          { gid: "ws-2", name: "Workspace Two" },
        ]))
        .mockResolvedValueOnce(makeProjectListResponse([{ gid: "proj-1", name: "Alpha" }]))
        .mockResolvedValueOnce(makeProjectListResponse([{ gid: "proj-2", name: "Beta" }]));

      const adapter = new AsanaAdapter("valid-token");
      const projects = await adapter.listProjects();

      expect(projects).toHaveLength(2);
      expect(projects[0]).toEqual({ externalId: "proj-1", displayName: "Alpha" });
      expect(projects[1]).toEqual({ externalId: "proj-2", displayName: "Beta" });
    });

    it("paginates workspaces using offset", async () => {
      mockGet
        .mockResolvedValueOnce(makeWorkspaceListResponse([{ gid: "ws-1", name: "WS1" }], "offset-ws-1"))
        .mockResolvedValueOnce(makeWorkspaceListResponse([{ gid: "ws-2", name: "WS2" }]))
        .mockResolvedValueOnce(makeProjectListResponse([{ gid: "proj-1", name: "P1" }]))
        .mockResolvedValueOnce(makeProjectListResponse([{ gid: "proj-2", name: "P2" }]));

      const adapter = new AsanaAdapter("valid-token");
      const projects = await adapter.listProjects();

      expect(projects).toHaveLength(2);
    });

    it("paginates projects within a workspace using offset", async () => {
      mockGet
        .mockResolvedValueOnce(makeWorkspaceListResponse([{ gid: "ws-1", name: "WS1" }]))
        .mockResolvedValueOnce(makeProjectListResponse([{ gid: "proj-1", name: "P1" }], "offset-proj-1"))
        .mockResolvedValueOnce(makeProjectListResponse([{ gid: "proj-2", name: "P2" }]));

      const adapter = new AsanaAdapter("valid-token");
      const projects = await adapter.listProjects();

      expect(projects).toHaveLength(2);
    });

    it("returns empty array when workspace has no projects", async () => {
      mockGet
        .mockResolvedValueOnce(makeWorkspaceListResponse([{ gid: "ws-1", name: "WS1" }]))
        .mockResolvedValueOnce(makeProjectListResponse([]));

      const adapter = new AsanaAdapter("valid-token");
      const projects = await adapter.listProjects();
      expect(projects).toEqual([]);
    });

    it("returns empty array when there are no workspaces", async () => {
      mockGet.mockResolvedValueOnce(makeWorkspaceListResponse([]));

      const adapter = new AsanaAdapter("valid-token");
      const projects = await adapter.listProjects();
      expect(projects).toEqual([]);
    });

    it("throws when API returns an error", async () => {
      mockGet.mockRejectedValue(new Error("API Error"));
      const adapter = new AsanaAdapter("valid-token");
      await expect(adapter.listProjects()).rejects.toThrow("API Error");
    });
  });

  // ─── fetchAssignedIssues ───────────────────────────────────────────────────

  describe("fetchAssignedIssues", () => {
    it("fetches assigned tasks and maps NormalizedIssue fields correctly", async () => {
      // tasks (no subtasks since second call returns empty)
      mockGet
        .mockResolvedValueOnce({ data: { data: { gid: "user-1" } } })  // /users/me
        .mockResolvedValueOnce(makeTaskListResponse([SAMPLE_TASK]))
        .mockResolvedValueOnce(makeTaskListResponse([])); // subtasks of task-1

      const adapter = new AsanaAdapter("valid-token");
      const issues = await adapter.fetchAssignedIssues("proj-1");

      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        externalId: "task-1",
        title: "Fix the bug",
        dueDate: new Date("2026-04-15"),
        externalUrl: "https://app.asana.com/0/project-1/task-1",
        isUnassigned: false,
        providerCreatedAt: new Date("2026-04-01T00:00:00.000Z"),
        providerUpdatedAt: new Date("2026-04-02T00:00:00.000Z"),
      });
    });

    it("includes assignee=me in the API request params", async () => {
      mockGet
        .mockResolvedValueOnce({ data: { data: { gid: "user-1" } } })  // /users/me
        .mockResolvedValueOnce(makeTaskListResponse([]))

      const adapter = new AsanaAdapter("valid-token");
      await adapter.fetchAssignedIssues("proj-1");

      expect(mockGet).toHaveBeenCalledWith(
        "/tasks",
        expect.objectContaining({
          params: expect.objectContaining({ assignee: "me" }),
        }),
      );
    });

    it("sets isUnassigned to false for all assigned issues", async () => {
      mockGet
        .mockResolvedValueOnce({ data: { data: { gid: "user-1" } } })  // /users/me
        .mockResolvedValueOnce(makeTaskListResponse([SAMPLE_TASK]))
        .mockResolvedValueOnce(makeTaskListResponse([]));

      const adapter = new AsanaAdapter("valid-token");
      const issues = await adapter.fetchAssignedIssues("proj-1");
      expect(issues[0].isUnassigned).toBe(false);
    });

    it("handles null due_on", async () => {
      const taskNoDue = { ...SAMPLE_TASK, due_on: null };
      mockGet
        .mockResolvedValueOnce({ data: { data: { gid: "user-1" } } })  // /users/me
        .mockResolvedValueOnce(makeTaskListResponse([taskNoDue]))
        .mockResolvedValueOnce(makeTaskListResponse([]));

      const adapter = new AsanaAdapter("valid-token");
      const issues = await adapter.fetchAssignedIssues("proj-1");
      expect(issues[0].dueDate).toBeNull();
    });

    it("maps gid to externalId", async () => {
      mockGet
        .mockResolvedValueOnce({ data: { data: { gid: "user-1" } } })  // /users/me
        .mockResolvedValueOnce(makeTaskListResponse([SAMPLE_TASK]))
        .mockResolvedValueOnce(makeTaskListResponse([]));

      const adapter = new AsanaAdapter("valid-token");
      const issues = await adapter.fetchAssignedIssues("proj-1");
      expect(issues[0].externalId).toBe("task-1");
    });

    it("maps created_at and modified_at to Date objects", async () => {
      mockGet
        .mockResolvedValueOnce({ data: { data: { gid: "user-1" } } })  // /users/me
        .mockResolvedValueOnce(makeTaskListResponse([SAMPLE_TASK]))
        .mockResolvedValueOnce(makeTaskListResponse([]));

      const adapter = new AsanaAdapter("valid-token");
      const issues = await adapter.fetchAssignedIssues("proj-1");
      expect(issues[0].providerCreatedAt).toEqual(new Date("2026-04-01T00:00:00.000Z"));
      expect(issues[0].providerUpdatedAt).toEqual(new Date("2026-04-02T00:00:00.000Z"));
    });

    it("fetches subtasks recursively", async () => {
      const subtask = {
        gid: "subtask-1",
        name: "Subtask One",
        due_on: null,
        permalink_url: "https://app.asana.com/0/project-1/subtask-1",
        assignee: { gid: "user-1" },
        created_at: "2026-04-03T00:00:00.000Z",
        modified_at: "2026-04-03T00:00:00.000Z",
      };

      mockGet
        .mockResolvedValueOnce({ data: { data: { gid: "user-1" } } })   // /users/me
        .mockResolvedValueOnce(makeTaskListResponse([SAMPLE_TASK]))       // top-level tasks
        .mockResolvedValueOnce(makeTaskListResponse([subtask]))           // subtasks of task-1
        .mockResolvedValueOnce(makeTaskListResponse([]));                 // subtasks of subtask-1

      const adapter = new AsanaAdapter("valid-token");
      const issues = await adapter.fetchAssignedIssues("proj-1");

      expect(issues).toHaveLength(2);
      expect(issues[1].externalId).toBe("subtask-1");
      expect(issues[1].isUnassigned).toBe(false);
    });

    it("paginates top-level tasks using offset", async () => {
      const task2 = { ...SAMPLE_TASK, gid: "task-2", name: "Task Two" };
      mockGet
        .mockResolvedValueOnce({ data: { data: { gid: "user-1" } } })            // /users/me
        .mockResolvedValueOnce(makeTaskListResponse([SAMPLE_TASK], "offset-1"))   // page 1
        .mockResolvedValueOnce(makeTaskListResponse([task2]))                      // page 2
        .mockResolvedValueOnce(makeTaskListResponse([]))                           // subtasks of task-1
        .mockResolvedValueOnce(makeTaskListResponse([]));                          // subtasks of task-2

      const adapter = new AsanaAdapter("valid-token");
      const issues = await adapter.fetchAssignedIssues("proj-1");
      expect(issues).toHaveLength(2);
    });

    it("returns empty array when there are no assigned tasks", async () => {
      mockGet
        .mockResolvedValueOnce({ data: { data: { gid: "user-1" } } })  // /users/me
        .mockResolvedValueOnce(makeTaskListResponse([]));

      const adapter = new AsanaAdapter("valid-token");
      const issues = await adapter.fetchAssignedIssues("proj-1");
      expect(issues).toEqual([]);
    });

    it("excludes subtasks assigned to other users (not the authenticated user)", async () => {
      const otherUserSubtask = {
        gid: "sub-other",
        name: "Other User Subtask",
        due_on: null,
        permalink_url: "https://app.asana.com/0/p/sub-other",
        assignee: { gid: "user-other" },
        created_at: "2026-04-01T00:00:00.000Z",
        modified_at: "2026-04-01T00:00:00.000Z",
      };
      const mySubtask = {
        gid: "sub-me",
        name: "My Subtask",
        due_on: null,
        permalink_url: "https://app.asana.com/0/p/sub-me",
        assignee: { gid: "user-1" },
        created_at: "2026-04-01T00:00:00.000Z",
        modified_at: "2026-04-01T00:00:00.000Z",
      };

      mockGet
        .mockResolvedValueOnce({ data: { data: { gid: "user-1" } } })           // /users/me
        .mockResolvedValueOnce(makeTaskListResponse([SAMPLE_TASK]))               // top-level tasks
        .mockResolvedValueOnce(makeTaskListResponse([otherUserSubtask, mySubtask])) // subtasks of task-1
        .mockResolvedValueOnce(makeTaskListResponse([]));                          // subtasks of sub-me

      const adapter = new AsanaAdapter("valid-token");
      const issues = await adapter.fetchAssignedIssues("proj-1");

      expect(issues).toHaveLength(2);
      expect(issues.map((i) => i.externalId)).toEqual(["task-1", "sub-me"]);
    });

    it("caches /users/me and only calls it once across multiple subtask levels", async () => {
      const subtask = {
        gid: "sub-1",
        name: "Subtask",
        due_on: null,
        permalink_url: "https://app.asana.com/0/p/sub-1",
        assignee: { gid: "user-1" },
        created_at: "2026-04-01T00:00:00.000Z",
        modified_at: "2026-04-01T00:00:00.000Z",
      };

      mockGet
        .mockResolvedValueOnce({ data: { data: { gid: "user-1" } } })  // /users/me (only once)
        .mockResolvedValueOnce(makeTaskListResponse([SAMPLE_TASK]))      // top-level tasks
        .mockResolvedValueOnce(makeTaskListResponse([subtask]))           // subtasks of task-1
        .mockResolvedValueOnce(makeTaskListResponse([]));                 // subtasks of sub-1

      const adapter = new AsanaAdapter("valid-token");
      await adapter.fetchAssignedIssues("proj-1");

      const meCalls = (mockGet.mock.calls as unknown[][]).filter(
        (call) => call[0] === "/users/me",
      );
      expect(meCalls).toHaveLength(1);
    });
  });

  // ─── fetchUnassignedIssues ─────────────────────────────────────────────────

  describe("fetchUnassignedIssues", () => {
    it("returns only tasks with null assignee and sets isUnassigned=true", async () => {
      mockGet
        .mockResolvedValueOnce(makeTaskListResponse([SAMPLE_TASK, UNASSIGNED_TASK]))
        .mockResolvedValueOnce(makeTaskListResponse([])); // subtasks of unassigned task

      const adapter = new AsanaAdapter("valid-token");
      const issues = await adapter.fetchUnassignedIssues("proj-1");

      expect(issues).toHaveLength(1);
      expect(issues[0].externalId).toBe("task-2");
      expect(issues[0].isUnassigned).toBe(true);
    });

    it("does NOT include assignee=me in the API request", async () => {
      mockGet.mockResolvedValueOnce(makeTaskListResponse([]));

      const adapter = new AsanaAdapter("valid-token");
      await adapter.fetchUnassignedIssues("proj-1");

      const callParams = (mockGet.mock.calls[0] as unknown[])[1] as { params: Record<string, unknown> };
      expect(callParams.params).not.toHaveProperty("assignee");
    });

    it("fetches subtasks recursively and only includes unassigned ones", async () => {
      const assignedSubtask = {
        gid: "sub-assigned",
        name: "Assigned Subtask",
        due_on: null,
        permalink_url: "https://app.asana.com/0/p/sub-assigned",
        assignee: { gid: "user-1" },
        created_at: "2026-04-01T00:00:00.000Z",
        modified_at: "2026-04-01T00:00:00.000Z",
      };
      const unassignedSubtask = {
        gid: "sub-unassigned",
        name: "Unassigned Subtask",
        due_on: null,
        permalink_url: "https://app.asana.com/0/p/sub-unassigned",
        assignee: null,
        created_at: "2026-04-01T00:00:00.000Z",
        modified_at: "2026-04-01T00:00:00.000Z",
      };

      mockGet
        .mockResolvedValueOnce(makeTaskListResponse([UNASSIGNED_TASK]))          // top-level
        .mockResolvedValueOnce(makeTaskListResponse([assignedSubtask, unassignedSubtask]))  // subtasks
        .mockResolvedValueOnce(makeTaskListResponse([]));                          // subtasks of unassigned-subtask

      const adapter = new AsanaAdapter("valid-token");
      const issues = await adapter.fetchUnassignedIssues("proj-1");

      // UNASSIGNED_TASK + unassignedSubtask (assignedSubtask is filtered out)
      expect(issues).toHaveLength(2);
      expect(issues.map((i) => i.externalId)).toEqual(["task-2", "sub-unassigned"]);
      expect(issues.every((i) => i.isUnassigned)).toBe(true);
    });

    it("paginates top-level tasks using offset", async () => {
      const task3 = { ...UNASSIGNED_TASK, gid: "task-3", name: "Task Three" };
      mockGet
        .mockResolvedValueOnce(makeTaskListResponse([UNASSIGNED_TASK], "offset-1"))
        .mockResolvedValueOnce(makeTaskListResponse([task3]))
        .mockResolvedValueOnce(makeTaskListResponse([]))   // subtasks of task-2
        .mockResolvedValueOnce(makeTaskListResponse([]));  // subtasks of task-3

      const adapter = new AsanaAdapter("valid-token");
      const issues = await adapter.fetchUnassignedIssues("proj-1");
      expect(issues).toHaveLength(2);
    });

    it("returns empty array when no unassigned tasks exist", async () => {
      // All tasks are assigned
      mockGet.mockResolvedValueOnce(makeTaskListResponse([SAMPLE_TASK]));
      // No subtasks fetched because SAMPLE_TASK is assigned (filtered before recursion)

      const adapter = new AsanaAdapter("valid-token");
      const issues = await adapter.fetchUnassignedIssues("proj-1");
      expect(issues).toEqual([]);
    });
  });

  // ─── closeIssue ───────────────────────────────────────────────────────────

  describe("closeIssue", () => {
    it("calls PUT /tasks/{taskGid} with completed:true", async () => {
      mockPut.mockResolvedValue({ data: { data: { gid: "task-1" } } });

      const adapter = new AsanaAdapter("valid-token");
      await expect(adapter.closeIssue("proj-1", "task-1")).resolves.toBeUndefined();

      expect(mockPut).toHaveBeenCalledWith(
        "/tasks/task-1",
        { data: { completed: true } },
      );
    });

    it("ignores the projectGid parameter", async () => {
      mockPut.mockResolvedValue({ data: { data: {} } });

      const adapter = new AsanaAdapter("valid-token");
      await adapter.closeIssue("any-project", "task-42");

      expect(mockPut).toHaveBeenCalledWith("/tasks/task-42", { data: { completed: true } });
    });

    it("throws when PUT fails", async () => {
      mockPut.mockRejectedValue(new Error("Forbidden"));

      const adapter = new AsanaAdapter("valid-token");
      await expect(adapter.closeIssue("proj-1", "task-1")).rejects.toThrow("Forbidden");
    });
  });

  // ─── addComment ───────────────────────────────────────────────────────────

  describe("addComment", () => {
    it("calls POST /tasks/{taskGid}/stories with text", async () => {
      mockPost.mockResolvedValue({ data: { data: { gid: "story-1" } } });

      const adapter = new AsanaAdapter("valid-token");
      await expect(adapter.addComment("proj-1", "task-1", "Great work!")).resolves.toBeUndefined();

      expect(mockPost).toHaveBeenCalledWith(
        "/tasks/task-1/stories",
        { data: { text: "Great work!" } },
      );
    });

    it("ignores the projectGid parameter", async () => {
      mockPost.mockResolvedValue({ data: { data: {} } });

      const adapter = new AsanaAdapter("valid-token");
      await adapter.addComment("any-project", "task-99", "comment text");

      expect(mockPost).toHaveBeenCalledWith("/tasks/task-99/stories", { data: { text: "comment text" } });
    });

    it("throws when POST fails", async () => {
      mockPost.mockRejectedValue(new Error("Server Error"));

      const adapter = new AsanaAdapter("valid-token");
      await expect(adapter.addComment("proj-1", "task-1", "hi")).rejects.toThrow("Server Error");
    });
  });
});
