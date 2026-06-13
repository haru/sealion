/** GitHub issue provider adapter — supports both github.com and GitHub Enterprise Server. */
import axios from "axios";

import { buildAxiosProxyConfig } from "@/lib/proxy/proxy";
import type { ExternalProject, IssueProviderAdapter, NormalizedIssue } from "@/lib/types";

export { githubMetadata } from "./github.metadata";

/** Maximum pages fetched per paginated request to prevent unbounded iteration. */
const MAX_PAGES = 20;

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

  /**
   * Generic paginator for GitHub REST/Search endpoints.
   * Calls `url` with `{ ...params, per_page: 100, page }` on each iteration,
   * extracts items via `extractItems`, and stops when a page returns fewer than 100 items.
   * @param url - API path (relative to the axios base URL).
   * @param params - Additional query parameters (merged with per_page / page).
   * @param extractItems - Converts the raw response data to an array of T.
   * @param label - Short label used in the MAX_PAGES error message.
   * @throws If more than {@link MAX_PAGES} pages are required.
   */
  private async paginateGitHub<T>(
    url: string,
    params: Record<string, unknown>,
    extractItems: (data: unknown) => T[],
    label: string,
  ): Promise<T[]> {
    const items: T[] = [];
    let page = 1;

    while (true) {
      const { data } = await this.client.get<unknown>(url, { params: { ...params, per_page: 100, page } });
      const batch = extractItems(data);
      items.push(...batch);
      if (batch.length < 100) { break; }
      if (page >= MAX_PAGES) {
        throw new Error(`${label}: exceeded MAX_PAGES (${MAX_PAGES})`);
      }
      page++;
    }

    return items;
  }

  /**
   * @param token - GitHub personal access token.
   * @param baseUrl - Optional GHE base URL (e.g. `"https://github.example.com"`).
   *   When provided, the REST API base becomes `${baseUrl}/api/v3`.
   *   When omitted or null, defaults to `https://api.github.com`.
   */
  constructor(token: string, baseUrl?: string | null) {
    const BASE_URL = baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/api/v3`
      : "https://api.github.com";
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
   * On rejection the cache is cleared so the next call can retry.
   */
  private getLogin(): Promise<string> {
    if (!this.loginPromise) {
      this.loginPromise = this.client
        .get<GitHubUser>("/user")
        .then(({ data }) => data.login)
        .catch((error: unknown) => {
          this.loginPromise = null;
          throw error;
        });
    }
    return this.loginPromise;
  }

  /**
   * Parses a GitHub project external ID into owner and repo components.
   * Validates that the ID is exactly in "owner/repo" format with two non-empty segments.
   * @param projectExternalId - The project external ID (e.g. `"owner/repo"`).
   * @returns Object with `owner` and `repo` strings.
   * @throws \{Error\} If the ID is not valid "owner/repo" format.
   */
  private parseOwnerRepo(projectExternalId: string): { owner: string; repo: string } {
    const parts = projectExternalId.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(
        `Invalid GitHub project ID: "${projectExternalId}". Expected "owner/repo" format.`,
      );
    }
    return { owner: parts[0], repo: parts[1] };
  }

  /**
   * Fetches all pages of issues assigned to `login` in the given repository.
   * @param owner - Repository owner.
   * @param repo - Repository name.
   * @param login - Authenticated user's GitHub login.
   * @returns Flat array of issues across all pages.
   * @throws If more than {@link MAX_PAGES} pages are required or any request fails.
   */
  private fetchAssignedPages(owner: string, repo: string, login: string): Promise<GitHubIssue[]> {
    return this.paginateGitHub<GitHubIssue>(
      `/repos/${owner}/${repo}/issues`,
      { state: "open", assignee: login },
      (data) => data as GitHubIssue[],
      `fetchAssignedPages for ${owner}/${repo}`,
    );
  }

  /**
   * Normalizes a GitHub issue/PR to the common NormalizedIssue format.
   * @param issue - Raw GitHub issue/PR object.
   * @param isUnassigned - Whether the issue should be marked as unassigned.
   * @returns Normalized issue compatible with the unified issue list.
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
   * @throws If more than {@link MAX_PAGES} pages are required or any request fails.
   */
  private fetchReviewerPrs(owner: string, repo: string, login: string): Promise<GitHubIssue[]> {
    return this.paginateGitHub<GitHubIssue>(
      "/search/issues",
      { q: `is:pr is:open review-requested:${login} repo:${owner}/${repo}` },
      (data) => (data as { items: GitHubIssue[] }).items,
      `fetchReviewerPrs for ${owner}/${repo}`,
    );
  }

  /** {@inheritDoc} */
  async testConnection(): Promise<void> {
    await this.client.get("/user");
  }

  /** {@inheritDoc} */
  async listProjects(): Promise<ExternalProject[]> {
    const repos = await this.paginateGitHub<GitHubRepo>(
      "/user/repos",
      {},
      (data) => data as GitHubRepo[],
      "listProjects",
    );
    return repos.map((r) => ({ externalId: r.full_name, displayName: r.full_name }));
  }

  /** {@inheritDoc} */
  async fetchAssignedIssues(projectExternalId: string): Promise<NormalizedIssue[]> {
    const { owner, repo } = this.parseOwnerRepo(projectExternalId);
    const login = await this.getLogin();

    const [issues, reviewerPrs] = await Promise.all([
      this.fetchAssignedPages(owner, repo, login),
      this.fetchReviewerPrs(owner, repo, login),
    ]);

    const seen = new Set<string>();
    return [...issues, ...reviewerPrs]
      .filter((item) => {
        const id = String(item.number);
        if (seen.has(id)) { return false; }
        seen.add(id);
        return true;
      })
      .map((item) => this.normalizeIssue(item, false));
  }

  /** {@inheritDoc} */
  async fetchUnassignedIssues(projectExternalId: string): Promise<NormalizedIssue[]> {
    const { owner, repo } = this.parseOwnerRepo(projectExternalId);
    const issues = await this.paginateGitHub<GitHubIssue>(
      `/repos/${owner}/${repo}/issues`,
      { state: "open", assignee: "none" },
      (data) => data as GitHubIssue[],
      `fetchUnassignedIssues for ${owner}/${repo}`,
    );
    return issues.map((issue) => this.normalizeIssue(issue, true));
  }

  /** {@inheritDoc} */
  async closeIssue(projectExternalId: string, issueExternalId: string): Promise<void> {
    const { owner, repo } = this.parseOwnerRepo(projectExternalId);
    await this.client.patch(`/repos/${owner}/${repo}/issues/${issueExternalId}`, { state: "closed" });
  }

  /** {@inheritDoc} */
  async addComment(projectExternalId: string, issueExternalId: string, comment: string): Promise<void> {
    const { owner, repo } = this.parseOwnerRepo(projectExternalId);
    await this.client.post(`/repos/${owner}/${repo}/issues/${issueExternalId}/comments`, { body: comment });
  }
}

