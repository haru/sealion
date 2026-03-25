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
 * Valid sort criterion values for board settings.
 * - `"providerCreatedAt_desc"`: Sort by creation date, newest first.
 * - `"providerUpdatedAt_desc"`: Sort by last update date, newest first.
 * - `"dueDate_asc"`: Sort by due date, earliest first (nulls last).
 */
export type SortCriterion =
  | "providerCreatedAt_desc"
  | "providerUpdatedAt_desc"
  | "dueDate_asc";

/**
 * All valid sort criteria that can be used in board settings.
 * Used for validation of user input.
 */
export const VALID_SORT_CRITERIA: readonly SortCriterion[] = [
  "providerCreatedAt_desc",
  "providerUpdatedAt_desc",
  "dueDate_asc",
] as const;

/**
 * Maximum number of active sort criteria allowed in board settings.
 * Enforced in both the PUT /api/board-settings validation and the
 * GET /api/issues `sortOrder` query parameter parsing.
 */
export const MAX_SORT_CRITERIA = 3;

/**
 * Board display and sort settings for the authenticated user.
 * Controls which timestamps are shown on issue cards and how issues are ordered.
 */
export interface BoardSettings {
  /** Whether to display the provider-side creation timestamp on issue cards. */
  showCreatedAt: boolean;
  /** Whether to display the provider-side update timestamp on issue cards. */
  showUpdatedAt: boolean;
  /** Ordered list of sort criteria; earlier entries take priority. */
  sortOrder: SortCriterion[];
}

/**
 * Default board settings returned when the user has no saved settings.
 */
export const DEFAULT_BOARD_SETTINGS: BoardSettings = {
  showCreatedAt: true,
  showUpdatedAt: false,
  sortOrder: ["dueDate_asc", "providerUpdatedAt_desc"],
};

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
