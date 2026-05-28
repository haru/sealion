import axios from "axios";

import { buildAxiosProxyConfig } from "@/lib/proxy/proxy";
import type { ExternalProject, IssueProviderAdapter, NormalizedIssue } from "@/lib/types";

export { githubMetadata } from "./github.metadata";

/* eslint-disable @typescript-eslint/naming-convention */
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
/* eslint-enable @typescript-eslint/naming-convention */

interface GitHubUser {
  login: string;
}

/** Adapter for the GitHub issue provider. */
export class GitHubAdapter implements IssueProviderAdapter {
  static readonly iconUrl: string | null = "/providers/github.svg";

  private readonly client;
  private loginPromise: Promise<string> | null = null;

  constructor(token: string) {
    const BASE_URL = "https://api.github.com";
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      ...buildAxiosProxyConfig(BASE_URL),
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

  /**
   * Normalizes a GitHub issue/PR to the common NormalizedIssue format.
   * @param issue - Raw GitHub issue/PR object.
   * @param isUnassigned - Whether the issue should be marked as unassigned.
   */
  private normalizeIssue(issue: GitHubIssue, isUnassigned: boolean): NormalizedIssue {
    return {
      externalId: String(issue.number),
      title: issue.title,
      dueDate: issue.milestone?.due_on ? new Date(issue.milestone.due_on) : null,
      externalUrl: issue.html_url,
      isUnassigned,
      providerCreatedAt: new Date(issue.created_at),
      providerUpdatedAt: new Date(issue.updated_at),
    };
  }

  /**
   * Fetches open PRs where the authenticated user is a requested reviewer.
   * Uses the GitHub Search API with `review-requested:` qualifier which
   * matches only individual reviewers, not team reviewers (FR-011).
   * @param owner - Repository owner.
   * @param repo - Repository name.
   * @param login - Authenticated user's GitHub login.
   * @returns Array of PRs the user is requested to review.
   */
  private async fetchReviewerPrs(owner: string, repo: string, login: string): Promise<GitHubIssue[]> {
    const prs: GitHubIssue[] = [];
    let page = 1;

    while (true) {
      const { data } = await this.client.get<{ items: GitHubIssue[] }>("/search/issues", {
        params: {
          q: `is:pr is:open review-requested:${login} repo:${owner}/${repo}`,
          per_page: 100,
          page,
        },
      });
      prs.push(...data.items);
      if (data.items.length < 100) { break; }
      page++;
    }

    return prs;
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
      if (data.length < 100) { break; }
      page++;
    }

    return repos.map((r) => ({ externalId: r.full_name, displayName: r.full_name }));
  }

  /** {@inheritDoc} */
  async fetchAssignedIssues(projectExternalId: string): Promise<NormalizedIssue[]> {
    const [owner, repo] = projectExternalId.split("/");
    const login = await this.getLogin();

    const issues: GitHubIssue[] = [];
    let page = 1;

    while (true) {
      const { data } = await this.client.get<GitHubIssue[]>(
        `/repos/${owner}/${repo}/issues`,
        { params: { state: "open", assignee: login, per_page: 100, page } }
      );
      issues.push(...data);
      if (data.length < 100) { break; }
      page++;
    }

    const reviewerPrs = await this.fetchReviewerPrs(owner, repo, login);

    const seen = new Set<string>();
    const results: NormalizedIssue[] = [];

    for (const issue of issues) {
      const id = String(issue.number);
      if (seen.has(id)) { continue; }
      seen.add(id);
      results.push(this.normalizeIssue(issue, false));
    }

    for (const pr of reviewerPrs) {
      const id = String(pr.number);
      if (seen.has(id)) { continue; }
      seen.add(id);
      results.push(this.normalizeIssue(pr, false));
    }

    return results;
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
      if (data.length < 100) { break; }
      page++;
    }

    return issues.map((issue) => this.normalizeIssue(issue, true));
  }

  /** {@inheritDoc} */
  async closeIssue(projectExternalId: string, issueExternalId: string): Promise<void> {
    const [owner, repo] = projectExternalId.split("/");
    await this.client.patch(`/repos/${owner}/${repo}/issues/${issueExternalId}`, {
      state: "closed",
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

