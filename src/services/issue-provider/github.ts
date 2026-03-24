import axios from "axios";
import { IssueProviderAdapter, NormalizedIssue, ExternalProject } from "@/lib/types";

interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  html_url: string;
  assignee?: { login: string } | null;
  milestone?: { due_on?: string | null };
  created_at: string;
  updated_at: string;
}

interface GitHubRepo {
  full_name: string;
}

interface GitHubUser {
  login: string;
}

/** Adapter for the GitHub issue provider. */
export class GitHubAdapter implements IssueProviderAdapter {
  static readonly iconUrl: string | null = "/github.svg";

  private readonly client;
  private loginPromise: Promise<string> | null = null;

  constructor(token: string) {
    this.client = axios.create({
      baseURL: "https://api.github.com",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  }

  /**
   * Returns the authenticated GitHub username, cached after the first call.
   */
  private getLogin(): Promise<string> {
    if (!this.loginPromise) {
      this.loginPromise = this.client
        .get<GitHubUser>("/user")
        .then(({ data }) => data.login);
    }
    return this.loginPromise;
  }

  /** {@inheritDoc} */
  async testConnection(): Promise<void> {
    await this.client.get("/user");
  }

  /** {@inheritDoc} */
  async listProjects(): Promise<ExternalProject[]> {
    const repos: GitHubRepo[] = [];
    let page = 1;

    while (true) {
      const { data } = await this.client.get<GitHubRepo[]>("/user/repos", {
        params: { per_page: 100, page },
      });
      repos.push(...data);
      if (data.length < 100) break;
      page++;
    }

    return repos.map((r) => ({ externalId: r.full_name, displayName: r.full_name }));
  }

  /** {@inheritDoc} */
  async fetchAssignedIssues(projectExternalId: string): Promise<NormalizedIssue[]> {
    const [owner, repo] = projectExternalId.split("/");
    const assignee = await this.getLogin();
    const issues: GitHubIssue[] = [];
    let page = 1;

    while (true) {
      const { data } = await this.client.get<GitHubIssue[]>(
        `/repos/${owner}/${repo}/issues`,
        { params: { state: "open", assignee, per_page: 100, page } }
      );
      issues.push(...data);
      if (data.length < 100) break;
      page++;
    }

    return issues.map((issue) => ({
      externalId: String(issue.number),
      title: issue.title,
      dueDate: issue.milestone?.due_on ? new Date(issue.milestone.due_on) : null,
      externalUrl: issue.html_url,
      isUnassigned: false,
      providerCreatedAt: new Date(issue.created_at),
      providerUpdatedAt: new Date(issue.updated_at),
    }));
  }

  /** {@inheritDoc} */
  async fetchUnassignedIssues(projectExternalId: string): Promise<NormalizedIssue[]> {
    const [owner, repo] = projectExternalId.split("/");
    const issues: GitHubIssue[] = [];
    let page = 1;

    while (true) {
      const { data } = await this.client.get<GitHubIssue[]>(
        `/repos/${owner}/${repo}/issues`,
        { params: { state: "open", assignee: "none", per_page: 100, page } }
      );
      issues.push(...data);
      if (data.length < 100) break;
      page++;
    }

    return issues.map((issue) => ({
      externalId: String(issue.number),
      title: issue.title,
      dueDate: issue.milestone?.due_on ? new Date(issue.milestone.due_on) : null,
      externalUrl: issue.html_url,
      isUnassigned: true,
      providerCreatedAt: new Date(issue.created_at),
      providerUpdatedAt: new Date(issue.updated_at),
    }));
  }

  /** {@inheritDoc} */
  async closeIssue(projectExternalId: string, issueExternalId: string): Promise<void> {
    const [owner, repo] = projectExternalId.split("/");
    await this.client.patch(`/repos/${owner}/${repo}/issues/${issueExternalId}`, {
      state: "closed",
    });
  }

  /** {@inheritDoc} */
  async reopenIssue(projectExternalId: string, issueExternalId: string): Promise<void> {
    const [owner, repo] = projectExternalId.split("/");
    await this.client.patch(`/repos/${owner}/${repo}/issues/${issueExternalId}`, {
      state: "open",
    });
  }

  /** {@inheritDoc} */
  async addComment(projectExternalId: string, issueExternalId: string, comment: string): Promise<void> {
    const [owner, repo] = projectExternalId.split("/");
    await this.client.post(`/repos/${owner}/${repo}/issues/${issueExternalId}/comments`, {
      body: comment,
    });
  }
}
