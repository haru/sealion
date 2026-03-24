import axios from "axios";
import { IssueProviderAdapter, NormalizedIssue, ExternalProject } from "@/lib/types";
import { IssueStatus } from "@prisma/client";

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: {
      statusCategory: { key: string };
    };
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

interface JiraSearchResponse {
  issues: JiraIssue[];
  nextPageToken?: string;
}

interface JiraTransition {
  id: string;
  name: string;
  to: { statusCategory: { key: string } };
}

/**
 * Validates that a Jira project key contains only safe characters to prevent JQL injection.
 * Jira project keys consist of uppercase letters and digits (e.g. "ABC", "MY2").
 * @param key - The project external ID to validate.
 * @throws If the key contains characters that could be used for JQL injection.
 */
function assertSafeProjectKey(key: string): void {
  if (!/^[A-Z][A-Z0-9_]{0,19}$/.test(key)) {
    throw new Error(`Unsafe Jira project key: "${key}"`);
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

  /**
   * Executes a paginated JQL search and returns normalized issues.
   * @param jql - The JQL query string (must be pre-validated for safety).
   * @param isUnassigned - Whether fetched issues should be marked as unassigned.
   * @returns Array of {@link NormalizedIssue} matching the query.
   */
  private async searchIssues(jql: string, isUnassigned: boolean): Promise<NormalizedIssue[]> {
    const issues: JiraIssue[] = [];
    const maxResults = 100;
    let nextPageToken: string | undefined;

    while (true) {
      const body: Record<string, unknown> = { jql, maxResults, fields: ["summary", "status", "duedate", "created", "updated"] };
      if (nextPageToken) body.nextPageToken = nextPageToken;
      const { data } = await this.client.post<JiraSearchResponse>("/search/jql", body);
      issues.push(...data.issues);
      if (!data.nextPageToken || data.issues.length < maxResults) break;
      nextPageToken = data.nextPageToken;
    }

    return issues.map((issue) => {
      const isDone = issue.fields.status.statusCategory.key === "done";
      return {
        externalId: issue.key,
        title: issue.fields.summary,
        status: isDone ? IssueStatus.CLOSED : IssueStatus.OPEN,
        dueDate: issue.fields.duedate ? new Date(issue.fields.duedate) : null,
        externalUrl: `${this.baseUrl}/browse/${issue.key}`,
        isUnassigned,
        providerCreatedAt: issue.fields.created ? new Date(issue.fields.created) : null,
        providerUpdatedAt: issue.fields.updated ? new Date(issue.fields.updated) : null,
      };
    });
  }

  /** {@inheritDoc} */
  async fetchAssignedIssues(projectExternalId: string): Promise<NormalizedIssue[]> {
    assertSafeProjectKey(projectExternalId);
    const jql = `project = "${projectExternalId}" AND assignee = currentUser() AND statusCategory != Done ORDER BY created DESC`;
    return this.searchIssues(jql, false);
  }

  /** {@inheritDoc} */
  async fetchUnassignedIssues(projectExternalId: string): Promise<NormalizedIssue[]> {
    assertSafeProjectKey(projectExternalId);
    const jql = `project = "${projectExternalId}" AND assignee is EMPTY AND statusCategory != Done ORDER BY created DESC`;
    return this.searchIssues(jql, true);
  }

  /** {@inheritDoc} */
  async closeIssue(_projectExternalId: string, issueExternalId: string): Promise<void> {
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
  async reopenIssue(_projectExternalId: string, issueExternalId: string): Promise<void> {
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
