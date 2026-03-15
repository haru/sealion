import { IssuePriority, IssueStatus } from "@prisma/client";

export interface NormalizedIssue {
  externalId: string;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  dueDate: Date | null;
  externalUrl: string;
}

export interface ExternalProject {
  externalId: string;
  displayName: string;
}

export interface IssueProviderAdapter {
  testConnection(): Promise<void>;
  listProjects(): Promise<ExternalProject[]>;
  fetchAssignedIssues(projectExternalId: string): Promise<NormalizedIssue[]>;
  closeIssue(projectExternalId: string, issueExternalId: string): Promise<void>;
  reopenIssue(projectExternalId: string, issueExternalId: string): Promise<void>;
}
