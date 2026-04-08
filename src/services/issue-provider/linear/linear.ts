import { LinearClient } from "@linear/sdk";

import type { ExternalProject, IssueProviderAdapter, NormalizedIssue } from "@/lib/types";

export { linearMetadata } from "./linear.metadata";

/** Adapter for the Linear issue provider. */
export class LinearAdapter implements IssueProviderAdapter {
  private readonly client: LinearClient;
  /** Cached viewer ID promise to avoid redundant API calls. */
  private viewerPromise: Promise<string> | null = null;

  /**
   * Creates a new Linear adapter.
   * @param apiKey - Linear Personal API Key.
   */
  constructor(apiKey: string) {
    this.client = new LinearClient({ apiKey });
  }

  /**
   * Returns the authenticated Linear viewer ID, cached after the first call.
   * @returns The viewer's Linear user ID.
   */
  private getViewerId(): Promise<string> {
    if (!this.viewerPromise) {
      this.viewerPromise = this.client.viewer.then((v) => v.id);
    }
    return this.viewerPromise;
  }

  /**
   * Verifies the API key is valid by fetching the authenticated viewer.
   * @throws If authentication fails or a network error occurs.
   */
  async testConnection(): Promise<void> {
    await this.client.viewer;
  }

  /**
   * Lists all Linear teams accessible to the authenticated user.
   * Paginates using cursor-based pagination until all teams are retrieved.
   * @returns Array of {@link ExternalProject} with `externalId = team.id` and `displayName = team.name`.
   */
  async listProjects(): Promise<ExternalProject[]> {
    const projects: ExternalProject[] = [];
    let cursor: string | undefined;

    while (true) {
      const result = await this.client.teams({ first: 100, ...(cursor ? { after: cursor } : {}) });
      for (const team of result.nodes) {
        projects.push({ externalId: team.id, displayName: team.name });
      }
      if (!result.pageInfo.hasNextPage) { break; }
      cursor = result.pageInfo.endCursor ?? undefined;
    }

    return projects;
  }

  /**
   * Fetches open issues assigned to the authenticated user in the given team.
   * Issues with state type `completed` or `cancelled` are excluded by the server-side filter.
   * @param teamId - Linear team ID (stored as `Project.externalId`).
   * @returns Array of {@link NormalizedIssue} with `isUnassigned: false`.
   */
  async fetchAssignedIssues(teamId: string): Promise<NormalizedIssue[]> {
    const viewerId = await this.getViewerId();
    return this.fetchIssues(teamId, viewerId, false);
  }

  /**
   * Fetches open issues with no assignee in the given team.
   * Issues with state type `completed` or `cancelled` are excluded by the server-side filter.
   * @param teamId - Linear team ID (stored as `Project.externalId`).
   * @returns Array of {@link NormalizedIssue} with `isUnassigned: true`.
   */
  async fetchUnassignedIssues(teamId: string): Promise<NormalizedIssue[]> {
    return this.fetchIssues(teamId, null, true);
  }

  /**
   * Internal helper that fetches issues with the given team and assignee filter.
   * @param teamId - Linear team ID.
   * @param viewerId - Viewer ID for assigned filter, or `null` for unassigned.
   * @param isUnassigned - Value to set on returned {@link NormalizedIssue} records.
   * @returns Paginated and mapped issues.
   */
  private async fetchIssues(
    teamId: string,
    viewerId: string | null,
    isUnassigned: boolean,
  ): Promise<NormalizedIssue[]> {
    const issues: NormalizedIssue[] = [];
    let cursor: string | undefined;

    const assigneeFilter =
      viewerId !== null
        ? { assignee: { id: { eq: viewerId } } }
        : { assignee: null };

    while (true) {
      const result = await this.client.issues({
        filter: {
          team: { id: { eq: teamId } },
          ...assigneeFilter,
          state: { type: { nin: ["completed", "cancelled"] } },
        },
        ...(cursor ? { after: cursor } : {}),
      });

      for (const issue of result.nodes) {
        issues.push({
          externalId: issue.id,
          title: issue.title,
          dueDate: issue.dueDate ? new Date(issue.dueDate) : null,
          externalUrl: issue.url,
          isUnassigned,
          providerCreatedAt: new Date(issue.createdAt),
          providerUpdatedAt: new Date(issue.updatedAt),
        });
      }

      if (!result.pageInfo.hasNextPage) { break; }
      cursor = result.pageInfo.endCursor ?? undefined;
    }

    return issues;
  }

  /**
   * Closes a Linear issue by transitioning it to the first available `completed`-type workflow state.
   * @param _teamId - Accepted for interface compatibility but not used (Linear uses issue-level team).
   * @param issueId - Linear issue ID.
   * @throws If no `completed`-type workflow state exists for the issue's team.
   * @throws If the issue is not found or the update request fails.
   */
  async closeIssue(_teamId: string, issueId: string): Promise<void> {
    const issue = await this.client.issue(issueId);
    const team = await issue.team;

    if (!team) {
      throw new Error(`Team not found for issue ${issueId}`);
    }

    const states = await team.states();
    const completedState = states.nodes.find((s) => s.type === "completed");

    if (!completedState) {
      throw new Error(
        `No completed-type workflow state found for team of issue ${issueId}`,
      );
    }

    await this.client.updateIssue(issueId, { stateId: completedState.id });
  }

  /**
   * Adds a comment to a Linear issue.
   * @param _teamId - Accepted for interface compatibility but not used.
   * @param issueId - Linear issue ID.
   * @param comment - Comment body text.
   * @throws If the comment creation request fails.
   */
  async addComment(_teamId: string, issueId: string, comment: string): Promise<void> {
    await this.client.createComment({ issueId, body: comment });
  }
}
