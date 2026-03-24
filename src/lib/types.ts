/**
 * Normalized issue data returned by an {@link IssueProviderAdapter}.
 * All adapters must produce this shape for the sync pipeline.
 * All issues returned by adapters are open; closed issues are removed from the DB during sync.
 */
export interface NormalizedIssue {
  /** Unique identifier from the external provider. */
  externalId: string;
  /** Human-readable title of the issue. */
  title: string;
  /** Optional due date from the provider, or `null` if not set. */
  dueDate: Date | null;
  /** URL to the issue on the provider's website. */
  externalUrl: string;
  /** Whether the issue is unassigned (not assigned to any user). */
  isUnassigned: boolean;
  /** Timestamp when the issue was created in the external provider. */
  providerCreatedAt: Date | null;
  /** Timestamp when the issue was last updated in the external provider. */
  providerUpdatedAt: Date | null;
}

/** Represents a project as returned by an external issue provider. */
export interface ExternalProject {
  /** Unique identifier in the external provider (e.g. GitHub repo full name). */
  externalId: string;
  /** Human-readable name displayed in the UI. */
  displayName: string;
}

/**
 * Adapter interface that each issue provider (GitHub, Jira, Redmine) must implement.
 * The sync pipeline uses these methods to fetch and mutate issues on external services.
 */
export interface IssueProviderAdapter {
  /**
   * Verifies that the stored credentials are valid.
   * @throws Error when authentication fails or the provider is unreachable.
   */
  testConnection(): Promise<void>;

  /**
   * Lists projects/repositories accessible with the current credentials.
   * @returns An array of {@link ExternalProject} objects.
   */
  listProjects(): Promise<ExternalProject[]>;

  /**
   * Fetches open issues assigned to the authenticated user in the given project.
   * @param projectExternalId - External ID of the project (e.g. `owner/repo`).
   * @returns Normalized issues assigned to the current user.
   */
  fetchAssignedIssues(projectExternalId: string): Promise<NormalizedIssue[]>;

  /**
   * Fetches open issues not assigned to any user in the given project.
   * @param projectExternalId - External ID of the project.
   * @returns Normalized unassigned issues.
   */
  fetchUnassignedIssues(projectExternalId: string): Promise<NormalizedIssue[]>;

  /**
   * Closes the specified issue on the external provider.
   * @param projectExternalId - External ID of the project.
   * @param issueExternalId - External ID of the issue to close.
   */
  closeIssue(projectExternalId: string, issueExternalId: string): Promise<void>;

  /**
   * Posts a comment to the specified issue on the external provider.
   * @param projectExternalId - External ID of the project.
   * @param issueExternalId - External ID of the issue.
   * @param comment - Text content of the comment to post.
   * @throws Error when the provider API call fails.
   */
  addComment(
    projectExternalId: string,
    issueExternalId: string,
    comment: string
  ): Promise<void>;
}
