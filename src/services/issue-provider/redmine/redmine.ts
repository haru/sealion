import axios from "axios";

import { buildAxiosProxyConfig } from "@/lib/proxy/proxy";
import type { ExternalProject, IssueProviderAdapter, NormalizedIssue } from "@/lib/types";

export { redmineMetadata } from "./redmine.metadata";

/* eslint-disable @typescript-eslint/naming-convention */
interface RedmineIssue {
  id: number;
  subject: string;
  status: { id: number; name: string; is_closed?: boolean };
  due_date?: string | null;
  assigned_to?: { id: number; name: string };
  created_on?: string;
  updated_on?: string;
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

interface RedmineIssueListResponse {
  issues: RedmineIssue[];
  total_count: number;
}

interface RedmineIssueStatusResponse {
  issue_statuses: RedmineIssueStatus[];
}
/* eslint-enable @typescript-eslint/naming-convention */

/** Adapter for the Redmine issue provider. */
export class RedmineAdapter implements IssueProviderAdapter {
  static readonly iconUrl: string | null = "/redmine.svg";

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
      ...buildAxiosProxyConfig(this.baseUrl),
    });
  }

  /** {@inheritDoc} */
  async testConnection(): Promise<void> {
    await this.client.get("/users/current.json");
  }

  /** {@inheritDoc} */
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

  /** {@inheritDoc} */
  async fetchAssignedIssues(projectExternalId: string): Promise<NormalizedIssue[]> {
    const issues: RedmineIssue[] = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const { data } = await this.client.get<RedmineIssueListResponse>("/issues.json", {
        params: {
          project_id: projectExternalId,
          assigned_to_id: "me",
          status_id: "open",
          offset,
          limit,
        },
      });
      issues.push(...data.issues);
      if (!data.total_count || issues.length >= data.total_count) { break; }
      offset += limit;
    }

    return issues.map((issue) => ({
      externalId: String(issue.id),
      title: issue.subject,
      dueDate: issue.due_date ? new Date(issue.due_date) : null,
      externalUrl: `${this.baseUrl}/issues/${issue.id}`,
      isUnassigned: false,
      providerCreatedAt: issue.created_on ? new Date(issue.created_on) : null,
      providerUpdatedAt: issue.updated_on ? new Date(issue.updated_on) : null,
    }));
  }

  /** {@inheritDoc} */
  async fetchUnassignedIssues(projectExternalId: string): Promise<NormalizedIssue[]> {
    // The Redmine API does not support a server-side "unassigned" filter.
    // `assigned_to_id` only accepts a numeric user ID or the special value "me" —
    // there is no "none" token. We therefore fetch all open issues and filter
    // client-side for those without an `assigned_to` field.
    // MAX_PAGES guards against unbounded memory use; if the cap is reached with
    // remaining pages, we throw so the caller does not delete issues we never saw.
    const MAX_PAGES = 20;
    const allOpenIssues: RedmineIssue[] = [];
    let offset = 0;
    const limit = 100;
    let fetchedPages = 0;
    let serverTotal = 0;

    while (fetchedPages < MAX_PAGES) {
      const { data } = await this.client.get<RedmineIssueListResponse>("/issues.json", {
        params: {
          project_id: projectExternalId,
          status_id: "open",
          offset,
          limit,
        },
      });
      allOpenIssues.push(...data.issues);
      serverTotal = data.total_count ?? 0;
      fetchedPages++;
      if (!data.total_count || allOpenIssues.length >= data.total_count) { break; }
      offset += limit;
    }

    if (allOpenIssues.length < serverTotal) {
      throw new Error(
        `Redmine unassigned issues fetch truncated at ${MAX_PAGES} pages ` +
          `(fetched ${allOpenIssues.length} of ${serverTotal}); ` +
          `skipping sync to avoid deleting issues beyond the page cap`
      );
    }

    return allOpenIssues
      .filter((issue) => !issue.assigned_to)
      .map((issue) => ({
        externalId: String(issue.id),
        title: issue.subject,
        dueDate: issue.due_date ? new Date(issue.due_date) : null,
        externalUrl: `${this.baseUrl}/issues/${issue.id}`,
        isUnassigned: true,
        providerCreatedAt: issue.created_on ? new Date(issue.created_on) : null,
        providerUpdatedAt: issue.updated_on ? new Date(issue.updated_on) : null,
      }));
  }

  /** {@inheritDoc} */
  async closeIssue(projectExternalId: string, issueExternalId: string): Promise<void> {
    const { data } = await this.client.get<RedmineIssueStatusResponse>("/issue_statuses.json");
    const closedStatus = data.issue_statuses.find((s) => s.is_closed);
    if (!closedStatus) {
      throw new Error("No closed status found in Redmine");
    }
    await this.client.put(`/issues/${issueExternalId}.json`, {
      issue: { status_id: closedStatus.id },
    });
  }

  /** {@inheritDoc} */
  async addComment(_projectExternalId: string, issueExternalId: string, comment: string): Promise<void> {
    await this.client.put(`/issues/${issueExternalId}.json`, {
      issue: { notes: comment },
    });
  }
}

