import axios from "axios";
import { IssueProviderAdapter, NormalizedIssue, ExternalProject } from "@/lib/types";
import { IssueStatus, IssuePriority } from "@prisma/client";

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: {
      statusCategory: { key: string };
    };
    priority?: { name?: string };
    duedate?: string | null;
    assignee?: unknown;
    created?: string;
    updated?: string;
  };
}

interface JiraProject {
  id: string;
  key: string;
  name: string;
}

interface JiraTransition {
  id: string;
  name: string;
  to: { statusCategory: { key: string } };
}

/**
 * Maps a Jira priority name to the internal {@link IssuePriority} enum.
 * @param name - The Jira priority name (case-insensitive).
 */
function mapPriority(name?: string): IssuePriority {
  switch (name?.toLowerCase()) {
    case "highest":
    case "critical":
      return IssuePriority.CRITICAL;
    case "high":
      return IssuePriority.HIGH;
    case "low":
      return IssuePriority.LOW;
    case "lowest":
    case "trivial":
      return IssuePriority.LOW;
    default:
      return IssuePriority.MEDIUM;
  }
}

/** Adapter for the Jira issue provider. */
export class JiraAdapter implements IssueProviderAdapter {
  static readonly iconUrl: string | null = "/jira.svg";

  private readonly client;
  private readonly baseUrl: string;

  constructor(baseUrl: string, email: string, apiToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    const token = Buffer.from(`${email}:${apiToken}`).toString("base64");
    this.client = axios.create({
      baseURL: `${this.baseUrl}/rest/api/3`,
      headers: {
        Authorization: `Basic ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
  }

  /** {@inheritDoc} */
  async testConnection(): Promise<void> {
    await this.client.get("/myself");
  }

  /** {@inheritDoc} */
  async listProjects(): Promise<ExternalProject[]> {
    const { data } = await this.client.get<JiraProject[]>("/project");
    return data.map((p) => ({ externalId: p.key, displayName: `${p.name} (${p.key})` }));
  }

  /** {@inheritDoc} */
  async fetchAssignedIssues(projectExternalId: string): Promise<NormalizedIssue[]> {
    const jql = `project = "${projectExternalId}" AND assignee = currentUser() AND statusCategory != Done ORDER BY created DESC`;
    const issues: JiraIssue[] = [];
    let startAt = 0;
    const maxResults = 100;

    while (true) {
      const { data } = await this.client.get<{ issues: JiraIssue[]; total: number }>(
        "/search",
        { params: { jql, startAt, maxResults, fields: "summary,status,priority,duedate,created,updated" } }
      );
      issues.push(...data.issues);
      if (issues.length >= data.total) break;
      startAt += maxResults;
    }

    return issues.map((issue) => {
      const isDone = issue.fields.status.statusCategory.key === "done";
      return {
        externalId: issue.key,
        title: issue.fields.summary,
        status: isDone ? IssueStatus.CLOSED : IssueStatus.OPEN,
        priority: mapPriority(issue.fields.priority?.name),
        dueDate: issue.fields.duedate ? new Date(issue.fields.duedate) : null,
        externalUrl: `${this.baseUrl}/browse/${issue.key}`,
        isUnassigned: false,
        providerCreatedAt: issue.fields.created ? new Date(issue.fields.created) : null,
        providerUpdatedAt: issue.fields.updated ? new Date(issue.fields.updated) : null,
      };
    });
  }

  /** {@inheritDoc} */
  async fetchUnassignedIssues(projectExternalId: string): Promise<NormalizedIssue[]> {
    const jql = `project = "${projectExternalId}" AND assignee is EMPTY AND statusCategory != Done ORDER BY created DESC`;
    const issues: JiraIssue[] = [];
    let startAt = 0;
    const maxResults = 100;

    while (true) {
      const { data } = await this.client.get<{ issues: JiraIssue[]; total: number }>(
        "/search",
        { params: { jql, startAt, maxResults, fields: "summary,status,priority,duedate,created,updated" } }
      );
      issues.push(...data.issues);
      if (issues.length >= data.total) break;
      startAt += maxResults;
    }

    return issues.map((issue) => {
      const isDone = issue.fields.status.statusCategory.key === "done";
      return {
        externalId: issue.key,
        title: issue.fields.summary,
        status: isDone ? IssueStatus.CLOSED : IssueStatus.OPEN,
        priority: mapPriority(issue.fields.priority?.name),
        dueDate: issue.fields.duedate ? new Date(issue.fields.duedate) : null,
        externalUrl: `${this.baseUrl}/browse/${issue.key}`,
        isUnassigned: true,
        providerCreatedAt: issue.fields.created ? new Date(issue.fields.created) : null,
        providerUpdatedAt: issue.fields.updated ? new Date(issue.fields.updated) : null,
      };
    });
  }

  /** {@inheritDoc} */
  async closeIssue(projectExternalId: string, issueExternalId: string): Promise<void> {
    const { data } = await this.client.get<{ transitions: JiraTransition[] }>(
      `/issue/${issueExternalId}/transitions`
    );
    const doneTransition = data.transitions.find(
      (t) => t.to.statusCategory.key === "done"
    );
    if (!doneTransition) {
      throw new Error(`No "done" transition found for issue ${issueExternalId}`);
    }
    await this.client.post(`/issue/${issueExternalId}/transitions`, {
      transition: { id: doneTransition.id },
    });
  }

  /** {@inheritDoc} */
  async reopenIssue(projectExternalId: string, issueExternalId: string): Promise<void> {
    const { data } = await this.client.get<{ transitions: JiraTransition[] }>(
      `/issue/${issueExternalId}/transitions`
    );
    const todoTransition = data.transitions.find(
      (t) => t.to.statusCategory.key === "new"
    );
    if (!todoTransition) {
      throw new Error(`No "new" transition found for issue ${issueExternalId}`);
    }
    await this.client.post(`/issue/${issueExternalId}/transitions`, {
      transition: { id: todoTransition.id },
    });
  }
}
