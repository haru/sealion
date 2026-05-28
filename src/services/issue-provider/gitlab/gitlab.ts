import axios from "axios";

import { buildAxiosProxyConfig } from "@/lib/proxy/proxy";
import type { ExternalProject, IssueProviderAdapter, NormalizedIssue } from "@/lib/types";

export { gitlabMetadata } from "./gitlab.metadata";

/* eslint-disable @typescript-eslint/naming-convention */
interface GitLabIssue {
  id: number;
  iid: number;
  title: string;
  web_url: string;
  due_date: string | null;
  assignees: { id: number }[];
  created_at: string;
  updated_at: string;
}

interface GitLabMergeRequest {
  id: number;
  iid: number;
  title: string;
  web_url: string;
  due_date: string | null;
  assignees: { id: number }[];
  reviewers: { id: number }[];
  created_at: string;
  updated_at: string;
}

interface GitLabProject {
  id: number;
  name_with_namespace: string;
}
/* eslint-enable @typescript-eslint/naming-convention */

interface GitLabUser {
  id: number;
}

const MR_EXTERNAL_ID_PREFIX = "mr-";

/** Adapter for the GitLab issue provider. */
export class GitLabAdapter implements IssueProviderAdapter {
  static readonly iconUrl: string | null = "/providers/gitlab.svg";

  private readonly client;
  private readonly baseUrl: string;
  private userPromise: Promise<{ id: number }> | null = null;

  /**
   * Creates a new GitLab adapter.
   * @param token - GitLab personal access token.
   * @param baseUrl - GitLab instance base URL (defaults to `https://gitlab.com`).
   */
  constructor(token: string, baseUrl: string = "https://gitlab.com") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.client = axios.create({
      baseURL: `${this.baseUrl}/api/v4`,
      headers: {
        "PRIVATE-TOKEN": token,
        "Content-Type": "application/json",
      },
      ...buildAxiosProxyConfig(this.baseUrl),
    });
  }

  /**
   * Returns the authenticated GitLab user info, cached after the first call.
   * @returns Object containing the user's numeric ID.
   */
  private getUser(): Promise<{ id: number }> {
    if (!this.userPromise) {
      this.userPromise = this.client
        .get<GitLabUser>("/user")
        .then(({ data }) => ({ id: data.id }));
    }
    return this.userPromise;
  }

  /**
   * Paginates GitLab list API calls using the x-next-page header.
   * @param url - API endpoint URL.
   * @param params - Query parameters for the first page.
   * @returns Array of items across all pages.
   * @throws On network or API errors.
   */
  private async paginateGitLab<T>(url: string, params: Record<string, unknown>): Promise<T[]> {
    const items: T[] = [];
    let page = 1;

    while (true) {
      const { data, headers } = await this.client.get<T[]>(url, {
        params: { ...params, per_page: 100, page },
      });
      items.push(...data);
      const nextPage = headers["x-next-page"];
      if (!nextPage) { break; }
      page = Number(nextPage);
    }

    return items;
  }

  /**
   * Fetches merge requests for the project matching the given query parameters.
   * @param projectExternalId - GitLab project global ID.
   * @param queryParams - Additional query parameters (e.g. assignee_id, reviewer_id).
   * @returns Array of merge requests with mr- prefixed externalIds.
   */
  private async fetchMergeRequests(
    projectExternalId: string,
    queryParams: Record<string, unknown>,
  ): Promise<NormalizedIssue[]> {
    const mrs = await this.paginateGitLab<GitLabMergeRequest>(
      `/projects/${projectExternalId}/merge_requests`,
      { state: "opened", ...queryParams },
    );

    return mrs.map((mr) => ({
      externalId: `${MR_EXTERNAL_ID_PREFIX}${mr.id}`,
      title: mr.title,
      dueDate: mr.due_date ? new Date(mr.due_date) : null,
      externalUrl: mr.web_url,
      isUnassigned: false,
      providerCreatedAt: new Date(mr.created_at),
      providerUpdatedAt: new Date(mr.updated_at),
    }));
  }

  /**
   * Resolves a GitLab global merge request ID to its project-scoped IID.
   * @param globalMrId - The global MR ID (numeric part of externalId, without mr- prefix).
   * @returns The project-scoped IID.
   * @throws If the MR is not found (HTTP 404) or the request fails.
   */
  private async getMergeRequestIid(globalMrId: string): Promise<number> {
    const { data } = await this.client.get<{ iid: number }>(`/merge_requests/${globalMrId}`);
    return data.iid;
  }

  /**
   * Resolves a GitLab global issue ID to its project-scoped IID.
   * @param globalIssueId - The global issue ID (externalId stored in the database).
   * @returns The project-scoped IID.
   * @throws If the issue is not found (HTTP 404) or the request fails.
   */
  private async getIssueIid(globalIssueId: string): Promise<number> {
    const { data } = await this.client.get<{ iid: number }>(`/issues/${globalIssueId}`);
    return data.iid;
  }

  /** {@inheritDoc} */
  async testConnection(): Promise<void> {
    await this.client.get("/user");
  }

  /** {@inheritDoc} */
  async listProjects(): Promise<ExternalProject[]> {
    const projects = await this.paginateGitLab<GitLabProject>("/projects", {
      simple: true,
      membership: true,
    });

    return projects.map((p) => ({
      externalId: String(p.id),
      displayName: p.name_with_namespace,
    }));
  }

  /** {@inheritDoc} */
  async fetchAssignedIssues(projectExternalId: string): Promise<NormalizedIssue[]> {
    const { id: userId } = await this.getUser();

    const issues = await this.paginateGitLab<GitLabIssue>(
      `/projects/${projectExternalId}/issues`,
      { state: "opened", assignee_id: userId },
    );

    const assigneeMrs = await this.fetchMergeRequests(projectExternalId, {
      assignee_id: userId,
    });

    const reviewerMrs = await this.fetchMergeRequests(projectExternalId, {
      reviewer_id: userId,
    });

    const seen = new Set<string>();
    const results: NormalizedIssue[] = [];

    for (const issue of issues) {
      const id = String(issue.id);
      if (seen.has(id)) { continue; }
      seen.add(id);
      results.push({
        externalId: id,
        title: issue.title,
        dueDate: issue.due_date ? new Date(issue.due_date) : null,
        externalUrl: issue.web_url,
        isUnassigned: false,
        providerCreatedAt: new Date(issue.created_at),
        providerUpdatedAt: new Date(issue.updated_at),
      });
    }

    for (const mr of assigneeMrs) {
      if (seen.has(mr.externalId)) { continue; }
      seen.add(mr.externalId);
      results.push(mr);
    }

    for (const mr of reviewerMrs) {
      if (seen.has(mr.externalId)) { continue; }
      seen.add(mr.externalId);
      results.push(mr);
    }

    return results;
  }

  /** {@inheritDoc} */
  async fetchUnassignedIssues(projectExternalId: string): Promise<NormalizedIssue[]> {
    const issues = await this.paginateGitLab<GitLabIssue>(
      `/projects/${projectExternalId}/issues`,
      { state: "opened", assignee_id: "None" },
    );

    return issues.map((issue) => ({
      externalId: String(issue.id),
      title: issue.title,
      dueDate: issue.due_date ? new Date(issue.due_date) : null,
      externalUrl: issue.web_url,
      isUnassigned: true,
      providerCreatedAt: new Date(issue.created_at),
      providerUpdatedAt: new Date(issue.updated_at),
    }));
  }

  /** {@inheritDoc} */
  async closeIssue(projectExternalId: string, issueExternalId: string): Promise<void> {
    if (issueExternalId.startsWith(MR_EXTERNAL_ID_PREFIX)) {
      const globalId = issueExternalId.slice(MR_EXTERNAL_ID_PREFIX.length);
      const iid = await this.getMergeRequestIid(globalId);
      await this.client.put(`/projects/${projectExternalId}/merge_requests/${iid}`, {
        state_event: "close",
      });
      return;
    }

    const iid = await this.getIssueIid(issueExternalId);
    await this.client.put(`/projects/${projectExternalId}/issues/${iid}`, {
      state_event: "close",
    });
  }

  /** {@inheritDoc} */
  async addComment(projectExternalId: string, issueExternalId: string, comment: string): Promise<void> {
    if (issueExternalId.startsWith(MR_EXTERNAL_ID_PREFIX)) {
      const globalId = issueExternalId.slice(MR_EXTERNAL_ID_PREFIX.length);
      const iid = await this.getMergeRequestIid(globalId);
      await this.client.post(`/projects/${projectExternalId}/merge_requests/${iid}/notes`, {
        body: comment,
      });
      return;
    }

    const iid = await this.getIssueIid(issueExternalId);
    await this.client.post(`/projects/${projectExternalId}/issues/${iid}/notes`, {
      body: comment,
    });
  }
}
