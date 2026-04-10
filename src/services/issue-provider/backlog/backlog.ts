import axios from "axios";

import { buildAxiosProxyConfig } from "@/lib/proxy/proxy";
import type { ExternalProject, IssueProviderAdapter, NormalizedIssue } from "@/lib/types";

export { backlogMetadata } from "./backlog.metadata";

/** Backlog Issue status IDs treated as open (未対応, 処理中, 処理済み). */
const OPEN_STATUS_IDS = [1, 2, 3];

/** Backlog Issue status ID to set when closing an issue (完了). */
const CLOSE_STATUS_ID = 4;

/** Number of issues to fetch per page (Backlog API maximum). */
const PAGE_SIZE = 100;

/** Maximum number of pages to fetch for unassigned issues to prevent runaway requests. */
const MAX_PAGES = 20;

/** A single Backlog Issue as returned by the REST API v2 (used fields only). */
interface BacklogIssue {
  /** The numeric issue ID (used as externalId). */
  id: number;
  /** The issue key in PROJECT-123 format (used to build externalUrl). */
  issueKey: string;
  /** The issue title. */
  summary: string;
  /** ISO8601 due date, or null if not set. */
  dueDate: string | null;
  /** ISO8601 creation timestamp. */
  created: string;
  /** ISO8601 last-update timestamp. */
  updated: string;
  /** Assignee, or null if unassigned. */
  assignee: { id: number; name: string } | null;
  /** Current status. */
  status: { id: number; name: string };
}

/** A single Backlog project as returned by GET /api/v2/projects. */
interface BacklogProject {
  /** Numeric project ID (immutable, used as externalId). */
  id: number;
  /** Project display name. */
  name: string;
  /** Project key (renameable — not used as identifier). */
  projectKey: string;
}

/** The authenticated user as returned by GET /api/v2/users/myself. */
interface BacklogUser {
  /** Numeric user ID (used to filter assigned issues). */
  id: number;
  /** Login ID string. */
  userId: string;
  /** Display name. */
  name: string;
}

/** Adapter for the Backlog issue provider (Backlog REST API v2). */
export class BacklogAdapter implements IssueProviderAdapter {
  private readonly client;
  private readonly baseUrl: string;
  private myId: number | undefined;

  /**
   * Creates a new BacklogAdapter.
   *
   * @param baseUrl - The Backlog space URL (e.g. `https://myspace.backlog.com`).
   *   A trailing slash is stripped automatically.
   * @param apiKey - The Backlog API key. Appended to every request as the `apiKey` query parameter.
   */
  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.client = axios.create({
      baseURL: `${this.baseUrl}/api/v2`,
      params: { apiKey },
      ...buildAxiosProxyConfig(this.baseUrl),
    });
  }

  /**
   * Fetches and caches the authenticated user's numeric ID from `/users/myself`.
   * Subsequent calls return the cached value without an additional API request.
   *
   * @returns The numeric user ID of the currently authenticated user.
   * @throws If the request to `/users/myself` fails.
   */
  private async fetchMyId(): Promise<number> {
    if (this.myId !== undefined) {
      return this.myId;
    }
    const { data } = await this.client.get<BacklogUser>("/users/myself");
    this.myId = data.id;
    return this.myId;
  }

  /**
   * Maps a raw Backlog issue to a {@link NormalizedIssue}.
   *
   * @param issue - The raw Backlog issue from the API.
   * @param isUnassigned - Whether this issue should be marked as unassigned.
   * @returns The normalized issue.
   */
  private mapIssue(issue: BacklogIssue, isUnassigned: boolean): NormalizedIssue {
    return {
      externalId: String(issue.id),
      title: issue.summary,
      dueDate: issue.dueDate ? new Date(issue.dueDate) : null,
      externalUrl: `${this.baseUrl}/view/${issue.issueKey}`,
      isUnassigned,
      providerCreatedAt: new Date(issue.created),
      providerUpdatedAt: new Date(issue.updated),
    };
  }

  /**
   * Verifies the API key is valid by fetching the authenticated user.
   *
   * @throws If authentication fails or a network error occurs.
   */
  async testConnection(): Promise<void> {
    await this.client.get<BacklogUser>("/users/myself");
  }

  /**
   * Lists all Backlog projects accessible to the authenticated user.
   *
   * @returns Array of {@link ExternalProject} with `externalId = String(project.id)`
   *   and `displayName = project.name`.
   * @throws If the request to `/projects` fails.
   */
  async listProjects(): Promise<ExternalProject[]> {
    const { data } = await this.client.get<BacklogProject[]>("/projects");
    return data.map((project) => ({
      externalId: String(project.id),
      displayName: project.name,
    }));
  }

  /**
   * Fetches open Backlog issues assigned to the authenticated user in the given project.
   * Uses server-side `assigneeId[]` filtering and paginates until all issues are retrieved.
   *
   * Open statuses: 未対応 (1), 処理中 (2), 処理済み (3).
   *
   * @param projectId - The Backlog project numeric ID (stored as `Project.externalId`).
   * @returns Array of {@link NormalizedIssue} with `isUnassigned: false`.
   * @throws If any paginated request fails.
   */
  async fetchAssignedIssues(projectId: string): Promise<NormalizedIssue[]> {
    const myId = await this.fetchMyId();
    const issues: BacklogIssue[] = [];
    let offset = 0;

    while (true) {
      const { data } = await this.client.get<BacklogIssue[]>("/issues", {
        params: {
          "projectId[]": projectId,
          "statusId[]": OPEN_STATUS_IDS,
          "assigneeId[]": myId,
          count: PAGE_SIZE,
          offset,
        },
      });
      issues.push(...data);
      if (data.length < PAGE_SIZE) {
        break;
      }
      offset += PAGE_SIZE;
    }

    return issues.map((issue) => this.mapIssue(issue, false));
  }

  /**
   * Fetches open Backlog issues with no assignee in the given project.
   * Backlog API v2 does not support a server-side "unassigned only" filter,
   * so all open issues are fetched and filtered client-side by `assignee === null`.
   *
   * A page guard of {@link MAX_PAGES} prevents unbounded requests on large projects.
   * If the guard is hit, an error is thrown to fail the sync cycle and preserve
   * existing data.
   *
   * @param projectId - The Backlog project numeric ID (stored as `Project.externalId`).
   * @returns Array of {@link NormalizedIssue} with `isUnassigned: true`.
   * @throws If more than {@link MAX_PAGES} pages are required or any request fails.
   */
  async fetchUnassignedIssues(projectId: string): Promise<NormalizedIssue[]> {
    const issues: BacklogIssue[] = [];
    let offset = 0;
    let page = 0;

    while (true) {
      if (page >= MAX_PAGES) {
        throw new Error(
          `fetchUnassignedIssues: exceeded MAX_PAGES (${MAX_PAGES}) for project ${projectId}`,
        );
      }

      const { data } = await this.client.get<BacklogIssue[]>("/issues", {
        params: {
          "projectId[]": projectId,
          "statusId[]": OPEN_STATUS_IDS,
          count: PAGE_SIZE,
          offset,
        },
      });

      issues.push(...data);
      page++;

      if (data.length < PAGE_SIZE) {
        break;
      }
      offset += PAGE_SIZE;
    }

    return issues
      .filter((issue) => issue.assignee === null)
      .map((issue) => this.mapIssue(issue, true));
  }

  /**
   * Updates a Backlog issue status to 完了 (Closed, ID=4), effectively closing it.
   * After the next sync the issue will no longer be fetched (status 4 is not in OPEN_STATUS_IDS).
   *
   * @param _projectId - Accepted for interface compatibility but not used by Backlog.
   * @param issueId - The Backlog issue numeric ID (stored as `Issue.externalId`).
   * @throws If the PATCH request fails.
   */
  async closeIssue(_projectId: string, issueId: string): Promise<void> {
    await this.client.patch(`/issues/${issueId}`, { statusId: CLOSE_STATUS_ID });
  }

  /**
   * Posts a comment to a Backlog issue.
   *
   * @param _projectId - Accepted for interface compatibility but not used by Backlog.
   * @param issueId - The Backlog issue numeric ID (stored as `Issue.externalId`).
   * @param comment - The comment text to post.
   * @throws If the POST request fails.
   */
  async addComment(_projectId: string, issueId: string, comment: string): Promise<void> {
    await this.client.post(`/issues/${issueId}/comments`, { content: comment });
  }
}
