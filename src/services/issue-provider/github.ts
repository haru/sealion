import axios from "axios";
import { IssueProviderAdapter, NormalizedIssue, ExternalProject } from "@/lib/types";
import { IssueStatus, IssuePriority } from "@prisma/client";

interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  html_url: string;
  milestone?: { due_on?: string | null };
}

interface GitHubRepo {
  full_name: string;
}

interface GitHubUser {
  login: string;
}

export class GitHubAdapter implements IssueProviderAdapter {
  private readonly client;
  private loginCache: string | null = null;

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

  private async getLogin(): Promise<string> {
    if (this.loginCache) return this.loginCache;
    const { data } = await this.client.get<GitHubUser>("/user");
    this.loginCache = data.login;
    return this.loginCache;
  }

  async testConnection(): Promise<void> {
    await this.client.get("/user");
  }

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
      status: issue.state === "open" ? IssueStatus.OPEN : IssueStatus.CLOSED,
      priority: IssuePriority.MEDIUM,
      dueDate: issue.milestone?.due_on ? new Date(issue.milestone.due_on) : null,
      externalUrl: issue.html_url,
    }));
  }

  async closeIssue(projectExternalId: string, issueExternalId: string): Promise<void> {
    const [owner, repo] = projectExternalId.split("/");
    await this.client.patch(`/repos/${owner}/${repo}/issues/${issueExternalId}`, {
      state: "closed",
    });
  }

  async reopenIssue(projectExternalId: string, issueExternalId: string): Promise<void> {
    const [owner, repo] = projectExternalId.split("/");
    await this.client.patch(`/repos/${owner}/${repo}/issues/${issueExternalId}`, {
      state: "open",
    });
  }
}
