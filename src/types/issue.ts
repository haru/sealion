/**
 * Client-side representation of an issue as returned by the `/api/issues` endpoints.
 * Shared across dashboard page, TodoList, TodoItem, and TodayTasksArea components.
 */
export interface ClientIssue {
  /** Internal database ID. */
  id: string;
  /** External ID from the provider (e.g. GitHub issue number). */
  externalId: string;
  /** Issue title. */
  title: string;
  /** ISO 8601 due date string, or `null`. */
  dueDate: string | null;
  /** URL to the issue on the external provider. */
  externalUrl: string;
  /** Whether the issue has no assignee. */
  isUnassigned: boolean;
  /** Whether this issue is flagged for today's task list. */
  todayFlag: boolean;
  /** Position in today's task list, or `null` when not flagged. */
  todayOrder: number | null;
  /** ISO 8601 timestamp when the issue was added to today's list, or `null`. */
  todayAddedAt: string | null;
  /** ISO 8601 creation timestamp from the issue provider, or `null`. */
  providerCreatedAt: string | null;
  /** ISO 8601 update timestamp from the issue provider, or `null`. */
  providerUpdatedAt: string | null;
  /** Whether the user has pinned this issue to the top of the list. */
  pinned: boolean;
  /** Project metadata including provider info. */
  project: {
    /** Display name of the project. */
    displayName: string;
    /** Issue provider metadata. */
    issueProvider: {
      /** Provider icon URL or `null`. */
      iconUrl: string | null;
      /** Display name of the issue provider. */
      displayName: string;
    };
  };
}
