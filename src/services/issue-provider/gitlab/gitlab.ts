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

interface GitLabProject {
  id: number;
  name_with_namespace: string;
}
/* eslint-enable @typescript-eslint/naming-convention */

interface GitLabUser {
  id: number;
}

/** Adapter for the GitLab issue provider. */
export class GitLabAdapter implements IssueProviderAdapter {
  static readonly iconUrl: string | null = "/gitlab.svg";

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

  /** {@inheritDoc} */
  async testConnection(): Promise<void> {
    await this.client.get("/user");
  }

  /** {@inheritDoc} */
  async listProjects(): Promise<ExternalProject[]> {
    const projects: GitLabProject[] = [];
    let page = 1;

    while (true) {
      const { data, headers } = await this.client.get<GitLabProject[]>("/projects", {
        params: { simple: true, per_page: 100, page, membership: true },
      });
      projects.push(...data);
      const nextPage = headers["x-next-page"];
      if (!nextPage) { break; }
      page = Number(nextPage);
    }

    return projects.map((p) => ({
      externalId: String(p.id),
      displayName: p.name_with_namespace,
    }));
  }

  /** {@inheritDoc} */
  async fetchAssignedIssues(projectExternalId: string): Promise<NormalizedIssue[]> {
    const { id: userId } = await this.getUser();
    const issues: GitLabIssue[] = [];
    let page = 1;

    while (true) {
      const { data, headers } = await this.client.get<GitLabIssue[]>(
        `/projects/${projectExternalId}/issues`,
        { params: { state: "opened", assignee_id: userId, per_page: 100, page } },
      );
      issues.push(...data);
      const nextPage = headers["x-next-page"];
      if (!nextPage) { break; }
      page = Number(nextPage);
    }

    return issues.map((issue) => ({
      externalId: String(issue.id),
      title: issue.title,
      dueDate: issue.due_date ? new Date(issue.due_date) : null,
      externalUrl: issue.web_url,
      isUnassigned: false,
      providerCreatedAt: new Date(issue.created_at),
      providerUpdatedAt: new Date(issue.updated_at),
    }));
  }

  /** {@inheritDoc} */
  async fetchUnassignedIssues(projectExternalId: string): Promise<NormalizedIssue[]> {
    const issues: GitLabIssue[] = [];
    let page = 1;

    while (true) {
      const { data, headers } = await this.client.get<GitLabIssue[]>(
        `/projects/${projectExternalId}/issues`,
        { params: { state: "opened", assignee_id: "None", per_page: 100, page } },
      );
      issues.push(...data);
      const nextPage = headers["x-next-page"];
      if (!nextPage) { break; }
      page = Number(nextPage);
    }

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
  async closeIssue(projectExternalId: string, issueExternalId: string): Promise<void> {
    const iid = await this.getIssueIid(issueExternalId);
    await this.client.put(`/projects/${projectExternalId}/issues/${iid}`, {
      state_event: "close",
    });
  }

  /** {@inheritDoc} */
  async addComment(projectExternalId: string, issueExternalId: string, comment: string): Promise<void> {
    const iid = await this.getIssueIid(issueExternalId);
    await this.client.post(`/projects/${projectExternalId}/issues/${iid}/notes`, {
      body: comment,
    });
  }
}

