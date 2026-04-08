import axios from "axios";

import { buildAxiosProxyConfig } from "@/lib/proxy/proxy";
import type { ExternalProject, IssueProviderAdapter, NormalizedIssue } from "@/lib/types";

export { asanaMetadata } from "./asana.metadata";

/* eslint-disable @typescript-eslint/naming-convention */
/** A single Asana task as returned by the REST API. */
interface AsanaTask {
  gid: string;
  name: string;
  due_on: string | null;
  permalink_url: string;
  assignee: { gid: string } | null;
  created_at: string;
  modified_at: string;
}

/** A single Asana workspace as returned by the REST API. */
interface AsanaWorkspace {
  gid: string;
  name: string;
}

/** A single Asana project as returned by the REST API. */
interface AsanaProject {
  gid: string;
  name: string;
}
/* eslint-enable @typescript-eslint/naming-convention */

/** Paginated Asana API list response envelope. */
interface AsanaListResponse<T> {
  data: T[];
  next_page: { offset: string } | null; // eslint-disable-line @typescript-eslint/naming-convention
}

/** Opt-fields string for task requests — fetches all fields needed for NormalizedIssue mapping. */
const TASK_OPT_FIELDS =
  "gid,name,due_on,permalink_url,assignee,created_at,modified_at";

/** Adapter for the Asana issue provider. */
export class AsanaAdapter implements IssueProviderAdapter {
  private readonly client;
  private myGid: string | undefined;

  /**
   * Creates a new Asana adapter.
   *
   * @param token - Asana Personal Access Token.
   */
  constructor(token: string) {
    this.client = axios.create({
      baseURL: "https://app.asana.com/api/1.0",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...buildAxiosProxyConfig("https://app.asana.com"),
    });
  }

  /**
   * Fetches all pages of a paginated Asana list endpoint using offset-based pagination.
   *
   * @param path - The API path (e.g. `"/workspaces"`).
   * @param params - Additional query parameters to include on every request.
   * @returns All items across all pages.
   */
  private async fetchAllPages<T>(
    path: string,
    params: Record<string, string | number>,
  ): Promise<T[]> {
    const items: T[] = [];
    let offset: string | undefined;

    while (true) {
      const queryParams = { limit: 100, ...params, ...(offset ? { offset } : {}) };
      const { data: envelope } = await this.client.get<AsanaListResponse<T>>(path, {
        params: queryParams,
      });
      items.push(...envelope.data);
      if (!envelope.next_page) { break; }
      offset = envelope.next_page.offset;
    }

    return items;
  }

  /**
   * Fetches and caches the authenticated user's GID from `/users/me`.
   * Subsequent calls return the cached value without an additional API request.
   *
   * @returns The GID of the currently authenticated user.
   * @throws If the request to `/users/me` fails.
   */
  private async fetchMyGid(): Promise<string> {
    if (this.myGid !== undefined) {
      return this.myGid;
    }
    const { data } = await this.client.get<{ data: { gid: string } }>("/users/me");
    this.myGid = data.data.gid;
    return this.myGid;
  }

  /**
   * Verifies the API token is valid by fetching the authenticated user.
   *
   * @throws If authentication fails or a network error occurs.
   */
  async testConnection(): Promise<void> {
    await this.client.get("/users/me");
  }

  /**
   * Lists all Asana projects accessible to the authenticated user, across all workspaces.
   * Paginates both the workspace list and the per-workspace project list.
   *
   * @returns Array of {@link ExternalProject} with `externalId = project.gid` and `displayName = project.name`.
   */
  async listProjects(): Promise<ExternalProject[]> {
    const workspaces = await this.fetchAllPages<AsanaWorkspace>("/workspaces", {});
    const projects: ExternalProject[] = [];

    for (const workspace of workspaces) {
      const wsProjects = await this.fetchAllPages<AsanaProject>("/projects", {
        workspace: workspace.gid,
        opt_fields: "gid,name",
      });
      for (const project of wsProjects) {
        projects.push({ externalId: project.gid, displayName: project.name });
      }
    }

    return projects;
  }

  /**
   * Recursively fetches tasks (and their subtasks) from an Asana project.
   * For top-level tasks the `assignee` filter is applied; for subtasks a client-side filter
   * is applied to match the same assignee mode.
   *
   * @param projectGid - The Asana project GID.
   * @param assigneeMode - `"me"` to fetch only tasks assigned to the authenticated user;
   *   `"none"` to fetch only tasks with no assignee.
   * @returns All matching tasks and subtasks as {@link NormalizedIssue} records.
   */
  private async fetchTasksRecursive(
    projectGid: string,
    assigneeMode: "me" | "none",
  ): Promise<NormalizedIssue[]> {
    const topLevelParams: Record<string, string | number> = {
      project: projectGid,
      completed_since: "now",
      opt_fields: TASK_OPT_FIELDS,
    };

    // Fetch the authenticated user's GID upfront so subtask filtering is accurate.
    // The /tasks endpoint supports assignee=me server-side, but /subtasks does not,
    // so we must filter subtasks client-side using the exact GID.
    let myGid: string | undefined;
    if (assigneeMode === "me") {
      topLevelParams.assignee = "me";
      myGid = await this.fetchMyGid();
    }

    const topLevelTasks = await this.fetchAllPages<AsanaTask>("/tasks", topLevelParams);

    // For "none" mode, filter unassigned tasks client-side — Asana does not expose
    // a server-side "assignee is null" filter on the /tasks endpoint. This may increase
    // data transfer on large projects but is the only available approach.
    const filteredTopLevel =
      assigneeMode === "none"
        ? topLevelTasks.filter((t) => t.assignee === null)
        : topLevelTasks;

    const results: NormalizedIssue[] = [];

    for (const task of filteredTopLevel) {
      results.push(this.mapTask(task, assigneeMode === "none"));
      const subtasks = await this.fetchSubtasksRecursive(task.gid, assigneeMode, myGid);
      results.push(...subtasks);
    }

    return results;
  }

  /**
   * Recursively fetches subtasks of a given Asana task, applying the assignee filter.
   * The `/tasks/{gid}/subtasks` endpoint does not support server-side assignee filtering,
   * so all filtering is done client-side.
   *
   * @param taskGid - The parent task GID.
   * @param assigneeMode - Assignee filter mode (same as in {@link fetchTasksRecursive}).
   * @param myGid - The authenticated user's GID; required when `assigneeMode === "me"` to
   *   exclude subtasks assigned to other users.
   * @returns Matching subtasks (and their sub-subtasks) as {@link NormalizedIssue} records.
   */
  private async fetchSubtasksRecursive(
    taskGid: string,
    assigneeMode: "me" | "none",
    myGid?: string,
  ): Promise<NormalizedIssue[]> {
    const subtaskParams: Record<string, string | number> = {
      completed_since: "now",
      opt_fields: TASK_OPT_FIELDS,
    };

    const subtasks = await this.fetchAllPages<AsanaTask>(
      `/tasks/${taskGid}/subtasks`,
      subtaskParams,
    );

    const filtered =
      assigneeMode === "none"
        ? subtasks.filter((t) => t.assignee === null)
        : subtasks.filter((t) => t.assignee?.gid === myGid);

    const results: NormalizedIssue[] = [];

    for (const subtask of filtered) {
      results.push(this.mapTask(subtask, assigneeMode === "none"));
      const nestedSubtasks = await this.fetchSubtasksRecursive(subtask.gid, assigneeMode, myGid);
      results.push(...nestedSubtasks);
    }

    return results;
  }

  /**
   * Maps a raw Asana task object to a {@link NormalizedIssue}.
   *
   * @param task - The raw Asana task from the API.
   * @param isUnassigned - Whether this issue should be marked as unassigned.
   * @returns The normalized issue.
   */
  private mapTask(task: AsanaTask, isUnassigned: boolean): NormalizedIssue {
    return {
      externalId: task.gid,
      title: task.name,
      dueDate: task.due_on ? new Date(task.due_on) : null,
      externalUrl: task.permalink_url,
      isUnassigned,
      providerCreatedAt: new Date(task.created_at),
      providerUpdatedAt: new Date(task.modified_at),
    };
  }

  /**
   * Fetches open Asana tasks assigned to the authenticated user in the given project.
   * Includes subtasks recursively.
   *
   * @param projectGid - The Asana project GID (stored as `Project.externalId`).
   * @returns Array of {@link NormalizedIssue} with `isUnassigned: false`.
   */
  async fetchAssignedIssues(projectGid: string): Promise<NormalizedIssue[]> {
    return this.fetchTasksRecursive(projectGid, "me");
  }

  /**
   * Fetches open Asana tasks with no assignee in the given project.
   * Includes subtasks recursively.
   *
   * @param projectGid - The Asana project GID (stored as `Project.externalId`).
   * @returns Array of {@link NormalizedIssue} with `isUnassigned: true`.
   */
  async fetchUnassignedIssues(projectGid: string): Promise<NormalizedIssue[]> {
    return this.fetchTasksRecursive(projectGid, "none");
  }

  /**
   * Marks an Asana task as complete.
   *
   * @param _projectGid - Accepted for interface compatibility but not used by Asana.
   * @param taskGid - The Asana task GID.
   * @throws If the PUT request fails.
   */
  async closeIssue(_projectGid: string, taskGid: string): Promise<void> {
    await this.client.put(`/tasks/${taskGid}`, { data: { completed: true } });
  }

  /**
   * Adds a comment (story) to an Asana task.
   *
   * @param _projectGid - Accepted for interface compatibility but not used by Asana.
   * @param taskGid - The Asana task GID.
   * @param comment - The comment text to post.
   * @throws If the POST request fails.
   */
  async addComment(_projectGid: string, taskGid: string, comment: string): Promise<void> {
    await this.client.post(`/tasks/${taskGid}/stories`, { data: { text: comment } });
  }
}
