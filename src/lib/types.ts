import { IssuePriority, IssueStatus } from "@prisma/client";

export type Priority = IssuePriority;
export type Status = IssueStatus;

export interface NormalizedIssue {
  externalId: string;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  dueDate: Date | null;
  externalUrl: string;
  isUnassigned: boolean;
}

export interface ExternalProject {
  externalId: string;
  displayName: string;
}

export interface IssueProviderAdapter {
  testConnection(): Promise<void>;
  listProjects(): Promise<ExternalProject[]>;
  fetchAssignedIssues(projectExternalId: string): Promise<NormalizedIssue[]>;
  fetchUnassignedIssues(projectExternalId: string): Promise<NormalizedIssue[]>;
  closeIssue(projectExternalId: string, issueExternalId: string): Promise<void>;
  reopenIssue(projectExternalId: string, issueExternalId: string): Promise<void>;
}
