import axios from "axios";
import { IssueProviderAdapter, NormalizedIssue, ExternalProject } from "@/lib/types";
import { IssueStatus, IssuePriority } from "@prisma/client";

interface RedmineIssue {
  id: number;
  subject: string;
  status: { id: number; name: string; is_closed?: boolean };
  priority?: { id: number; name: string };
  due_date?: string | null;
}

interface RedmineProject {
  id: number;
  identifier: string;
  name: string;
}

interface RedmineIssueStatus {
  id: number;
  name: string;
  is_closed: boolean;
}

function mapPriority(name?: string): IssuePriority {
  switch (name?.toLowerCase()) {
    case "urgent":
    case "immediate":
      return IssuePriority.CRITICAL;
    case "high":
      return IssuePriority.HIGH;
    case "low":
      return IssuePriority.LOW;
    default:
      return IssuePriority.MEDIUM;
  }
}

export class RedmineAdapter implements IssueProviderAdapter {
  static readonly iconUrl: string | null = "/redmine.png";

  private readonly client;
  private readonly baseUrl: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "X-Redmine-API-Key": apiKey,
        "Content-Type": "application/json",
      },
    });
  }

  async testConnection(): Promise<void> {
    await this.client.get("/users/current.json");
  }

  async listProjects(): Promise<ExternalProject[]> {
    const { data } = await this.client.get<{ projects: RedmineProject[] }>(
      "/projects.json",
      { params: { limit: 100 } }
    );
    return data.projects.map((p) => ({
      externalId: p.identifier,
      displayName: p.name,
    }));
  }

  async fetchAssignedIssues(projectExternalId: string): Promise<NormalizedIssue[]> {
    const issues: RedmineIssue[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const { data } = await this.client.get<{
        issues: RedmineIssue[];
        total_count: number;
      }>("/issues.json", {
        params: {
          project_id: projectExternalId,
          assigned_to_id: "me",
          status_id: "open",
          offset,
          limit,
        },
      });
      issues.push(...data.issues);
      if (issues.length >= data.total_count) break;
      offset += limit;
    }

    return issues.map((issue) => ({
      externalId: String(issue.id),
      title: issue.subject,
      status: issue.status.is_closed ? IssueStatus.CLOSED : IssueStatus.OPEN,
      priority: mapPriority(issue.priority?.name),
      dueDate: issue.due_date ? new Date(issue.due_date) : null,
      externalUrl: `${this.baseUrl}/issues/${issue.id}`,
    }));
  }

  async closeIssue(projectExternalId: string, issueExternalId: string): Promise<void> {
    const { data } = await this.client.get<{ issue_statuses: RedmineIssueStatus[] }>(
      "/issue_statuses.json"
    );
    const closedStatus = data.issue_statuses.find((s) => s.is_closed);
    if (!closedStatus) {
      throw new Error("No closed status found in Redmine");
    }
    await this.client.put(`/issues/${issueExternalId}.json`, {
      issue: { status_id: closedStatus.id },
    });
  }

  async reopenIssue(projectExternalId: string, issueExternalId: string): Promise<void> {
    const { data } = await this.client.get<{ issue_statuses: RedmineIssueStatus[] }>(
      "/issue_statuses.json"
    );
    const openStatus = data.issue_statuses.find((s) => !s.is_closed);
    if (!openStatus) {
      throw new Error("No open status found in Redmine");
    }
    await this.client.put(`/issues/${issueExternalId}.json`, {
      issue: { status_id: openStatus.id },
    });
  }
}
