import axios from "axios";

import { buildAxiosProxyConfig } from "@/lib/proxy/proxy";
import type { ExternalProject, IssueProviderAdapter, NormalizedIssue } from "@/lib/types";

export { trelloMetadata } from "./trello.metadata";

/** A single Trello card as returned by the REST API. */
interface TrelloCard {
  id: string;
  name: string;
  due: string | null;
  url: string;
  dateLastActivity: string;
  idMembers: string[];
  idBoard: string;
}

/** A single Trello board as returned by the REST API. */
interface TrelloBoard {
  id: string;
  name: string;
}

/** A Trello member as returned by GET /1/members/me. */
interface TrelloMember {
  id: string;
  username: string;
}

/** Opt-fields string for card requests — fetches all fields needed for NormalizedIssue mapping. */
const CARD_FIELDS = "id,name,due,url,dateLastActivity,idMembers,idBoard";

/** Adapter for the Trello issue provider. */
export class TrelloAdapter implements IssueProviderAdapter {
  private readonly client;
  private myId: string | undefined;

  /**
   * Creates a new Trello adapter.
   *
   * @param apiKey - Trello API Key.
   * @param apiToken - Trello API Token.
   */
  constructor(apiKey: string, apiToken: string) {
    this.client = axios.create({
      baseURL: "https://api.trello.com/1",
      params: {
        key: apiKey,
        token: apiToken,
      },
      ...buildAxiosProxyConfig("https://api.trello.com"),
    });
  }

  /**
   * Fetches and caches the authenticated user's member ID from `/members/me`.
   * Subsequent calls return the cached value without an additional API request.
   *
   * @returns The member ID of the currently authenticated user.
   * @throws If the request to `/members/me` fails.
   */
  private async fetchMyId(): Promise<string> {
    if (this.myId !== undefined) {
      return this.myId;
    }
    const { data } = await this.client.get<TrelloMember>("/members/me");
    this.myId = data.id;
    return this.myId;
  }

  /**
   * Maps a raw Trello card object to a {@link NormalizedIssue}.
   *
   * @param card - The raw Trello card from the API.
   * @param isUnassigned - Whether this issue should be marked as unassigned.
   * @returns The normalized issue.
   */
  private mapCard(card: TrelloCard, isUnassigned: boolean): NormalizedIssue {
    return {
      externalId: card.id,
      title: card.name,
      dueDate: card.due ? new Date(card.due) : null,
      externalUrl: card.url,
      isUnassigned,
      providerCreatedAt: null,
      providerUpdatedAt: new Date(card.dateLastActivity),
    };
  }

  /**
   * Verifies the API key and token are valid by fetching the authenticated member.
   *
   * @throws If authentication fails or a network error occurs.
   */
  async testConnection(): Promise<void> {
    await this.fetchMyId();
  }

  /**
   * Lists all open Trello boards accessible to the authenticated user.
   *
   * @returns Array of {@link ExternalProject} with `externalId = board.id` and `displayName = board.name`.
   */
  async listProjects(): Promise<ExternalProject[]> {
    const { data } = await this.client.get<TrelloBoard[]>("/members/me/boards", {
      params: {
        filter: "open",
        fields: "id,name",
      },
    });
    return data.map((board) => ({ externalId: board.id, displayName: board.name }));
  }

  /**
   * Fetches open Trello cards assigned to the authenticated user in the given board.
   * Client-side filtering by `idMembers` — only cards containing the member's ID are returned.
   *
   * @param boardId - The Trello board ID (stored as `Project.externalId`).
   * @returns Array of {@link NormalizedIssue} with `isUnassigned: false`.
   */
  async fetchAssignedIssues(boardId: string): Promise<NormalizedIssue[]> {
    const myId = await this.fetchMyId();
    const { data } = await this.client.get<TrelloCard[]>("/members/me/cards", {
      params: {
        filter: "open",
        fields: CARD_FIELDS,
        idBoards: boardId,
      },
    });
    return data
      .filter((card) => card.idMembers.includes(myId))
      .map((card) => this.mapCard(card, false));
  }

  /**
   * Fetches open Trello cards with no assignee in the given board.
   * Client-side filtering — only cards with empty `idMembers` are returned.
   *
   * @param boardId - The Trello board ID (stored as `Project.externalId`).
   * @returns Array of {@link NormalizedIssue} with `isUnassigned: true`.
   */
  async fetchUnassignedIssues(boardId: string): Promise<NormalizedIssue[]> {
    const { data } = await this.client.get<TrelloCard[]>(`/boards/${boardId}/cards`, {
      params: {
        filter: "open",
        fields: CARD_FIELDS,
      },
    });
    return data
      .filter((card) => card.idMembers.length === 0)
      .map((card) => this.mapCard(card, true));
  }

  /**
   * Archives a Trello card (Trello's equivalent of "close").
   *
   * @param _boardId - Accepted for interface compatibility but not used.
   * @param cardId - The Trello card ID.
   * @throws If the PUT request fails.
   */
  async closeIssue(_boardId: string, cardId: string): Promise<void> {
    await this.client.put(`/cards/${cardId}`, { closed: true });
  }

  /**
   * Adds a comment to a Trello card.
   *
   * @param _boardId - Accepted for interface compatibility but not used.
   * @param cardId - The Trello card ID.
   * @param comment - The comment text to post.
   * @throws If the POST request fails.
   */
  async addComment(_boardId: string, cardId: string, comment: string): Promise<void> {
    await this.client.post(`/cards/${cardId}/actions/comments`, { text: comment });
  }
}
