/** @jest-environment node */

jest.mock("axios", () => ({
  create: jest.fn().mockReturnValue({
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
  }),
}));

import axios from "axios";

const mockGet = jest.fn();
const mockPut = jest.fn();
const mockPost = jest.fn();

(axios.create as jest.Mock).mockReturnValue({
  get: mockGet,
  put: mockPut,
  post: mockPost,
});

import { TrelloAdapter } from "@/services/issue-provider/trello/trello";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SAMPLE_CARD = {
  id: "card-1",
  name: "Fix the bug",
  due: "2026-04-15T10:00:00.000Z",
  url: "https://trello.com/c/abc123/fix-the-bug",
  dateLastActivity: "2026-04-02T08:30:00.000Z",
  idMembers: ["member-me"],
  idBoard: "board-1",
};

const UNASSIGNED_CARD = {
  id: "card-2",
  name: "Unassigned task",
  due: null,
  url: "https://trello.com/c/def456/unassigned-task",
  dateLastActivity: "2026-04-01T12:00:00.000Z",
  idMembers: [],
  idBoard: "board-1",
};

const MEMBER_ME = { id: "member-me", username: "testuser" };

// ─── constructor ─────────────────────────────────────────────────────────────

describe("TrelloAdapter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("creates an axios client with the Trello API base URL", () => {
      new TrelloAdapter("my-key", "my-token");
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: "https://api.trello.com/1",
        }),
      );
    });

    it("does NOT set Authorization header (uses query-param auth)", () => {
      new TrelloAdapter("my-key", "my-token");
      const call = (axios.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      const headers = call.headers as Record<string, string> | undefined;
      expect(headers?.["Authorization"]).toBeUndefined();
    });

    it("passes apiKey and apiToken via params default", () => {
      new TrelloAdapter("test-key", "test-token");
      const call = (axios.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      const params = call.params as Record<string, string>;
      expect(params.key).toBe("test-key");
      expect(params.token).toBe("test-token");
    });
  });

  // ─── testConnection ────────────────────────────────────────────────────────

  describe("testConnection", () => {
    it("resolves when GET /members/me returns 200", async () => {
      mockGet.mockResolvedValue({ data: MEMBER_ME });
      const adapter = new TrelloAdapter("valid-key", "valid-token");
      await expect(adapter.testConnection()).resolves.toBeUndefined();
      expect(mockGet).toHaveBeenCalledWith("/members/me");
    });

    it("throws when GET /members/me returns 401", async () => {
      mockGet.mockRejectedValue(Object.assign(new Error("Unauthorized"), { response: { status: 401 } }));
      const adapter = new TrelloAdapter("bad-key", "bad-token");
      await expect(adapter.testConnection()).rejects.toThrow();
    });

    it("throws when rate limited (429)", async () => {
      mockGet.mockRejectedValue(Object.assign(new Error("Rate limited"), { response: { status: 429 } }));
      const adapter = new TrelloAdapter("valid-key", "valid-token");
      await expect(adapter.testConnection()).rejects.toThrow();
    });

    it("throws on network error", async () => {
      mockGet.mockRejectedValue(new Error("Network error"));
      const adapter = new TrelloAdapter("valid-key", "valid-token");
      await expect(adapter.testConnection()).rejects.toThrow("Network error");
    });

    it("caches member ID from testConnection response", async () => {
      mockGet.mockResolvedValue({ data: MEMBER_ME });
      const adapter = new TrelloAdapter("valid-key", "valid-token");
      await adapter.testConnection();
      await adapter.testConnection();
      const meCalls = (mockGet.mock.calls as unknown[][]).filter(
        (call) => call[0] === "/members/me",
      );
      expect(meCalls).toHaveLength(1);
    });
  });

  // ─── listProjects ──────────────────────────────────────────────────────────

  describe("listProjects", () => {
    it("returns boards as ExternalProject array", async () => {
      mockGet.mockResolvedValue({
        data: [
          { id: "board-1", name: "Project Alpha" },
          { id: "board-2", name: "Project Beta" },
        ],
      });
      const adapter = new TrelloAdapter("valid-key", "valid-token");
      const projects = await adapter.listProjects();
      expect(projects).toEqual([
        { externalId: "board-1", displayName: "Project Alpha" },
        { externalId: "board-2", displayName: "Project Beta" },
      ]);
    });

    it("sends filter=open and fields=id,name query params", async () => {
      mockGet.mockResolvedValue({ data: [] });
      const adapter = new TrelloAdapter("valid-key", "valid-token");
      await adapter.listProjects();
      expect(mockGet).toHaveBeenCalledWith(
        "/members/me/boards",
        expect.objectContaining({
          params: expect.objectContaining({
            filter: "open",
            fields: "id,name",
          }),
        }),
      );
    });

    it("returns empty array when no boards exist", async () => {
      mockGet.mockResolvedValue({ data: [] });
      const adapter = new TrelloAdapter("valid-key", "valid-token");
      const projects = await adapter.listProjects();
      expect(projects).toEqual([]);
    });

    it("throws when API returns an error", async () => {
      mockGet.mockRejectedValue(new Error("API Error"));
      const adapter = new TrelloAdapter("valid-key", "valid-token");
      await expect(adapter.listProjects()).rejects.toThrow("API Error");
    });
  });

  // ─── fetchAssignedIssues ───────────────────────────────────────────────────

  describe("fetchAssignedIssues", () => {
    it("fetches cards assigned to me and maps NormalizedIssue fields correctly", async () => {
      mockGet
        .mockResolvedValueOnce({ data: MEMBER_ME })
        .mockResolvedValueOnce({ data: [SAMPLE_CARD] });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      const issues = await adapter.fetchAssignedIssues("board-1");

      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        externalId: "card-1",
        title: "Fix the bug",
        dueDate: new Date("2026-04-15T10:00:00.000Z"),
        externalUrl: "https://trello.com/c/abc123/fix-the-bug",
        isUnassigned: false,
        providerCreatedAt: null,
        providerUpdatedAt: new Date("2026-04-02T08:30:00.000Z"),
      });
    });

    it("fetches member ID via /members/me when not cached", async () => {
      mockGet
        .mockResolvedValueOnce({ data: MEMBER_ME })
        .mockResolvedValueOnce({ data: [SAMPLE_CARD] });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      await adapter.fetchAssignedIssues("board-1");

      expect(mockGet).toHaveBeenCalledWith("/members/me");
    });

    it("filters out cards not assigned to the authenticated member", async () => {
      const otherMemberCard = {
        ...SAMPLE_CARD,
        id: "card-other",
        name: "Other member task",
        idMembers: ["member-other"],
      };
      mockGet
        .mockResolvedValueOnce({ data: MEMBER_ME })
        .mockResolvedValueOnce({ data: [SAMPLE_CARD, otherMemberCard] });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      const issues = await adapter.fetchAssignedIssues("board-1");
      expect(issues).toHaveLength(1);
      expect(issues[0].externalId).toBe("card-1");
    });

    it("filters out unassigned cards", async () => {
      mockGet
        .mockResolvedValueOnce({ data: MEMBER_ME })
        .mockResolvedValueOnce({ data: [SAMPLE_CARD, UNASSIGNED_CARD] });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      const issues = await adapter.fetchAssignedIssues("board-1");
      expect(issues).toHaveLength(1);
      expect(issues[0].externalId).toBe("card-1");
    });

    it("handles null due date", async () => {
      const noDueCard = { ...SAMPLE_CARD, due: null };
      mockGet
        .mockResolvedValueOnce({ data: MEMBER_ME })
        .mockResolvedValueOnce({ data: [noDueCard] });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      const issues = await adapter.fetchAssignedIssues("board-1");
      expect(issues[0].dueDate).toBeNull();
    });

    it("sets isUnassigned to false", async () => {
      mockGet
        .mockResolvedValueOnce({ data: MEMBER_ME })
        .mockResolvedValueOnce({ data: [SAMPLE_CARD] });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      const issues = await adapter.fetchAssignedIssues("board-1");
      expect(issues[0].isUnassigned).toBe(false);
    });

    it("sets providerCreatedAt to null", async () => {
      mockGet
        .mockResolvedValueOnce({ data: MEMBER_ME })
        .mockResolvedValueOnce({ data: [SAMPLE_CARD] });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      const issues = await adapter.fetchAssignedIssues("board-1");
      expect(issues[0].providerCreatedAt).toBeNull();
    });

    it("maps dateLastActivity to providerUpdatedAt as Date object", async () => {
      mockGet
        .mockResolvedValueOnce({ data: MEMBER_ME })
        .mockResolvedValueOnce({ data: [SAMPLE_CARD] });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      const issues = await adapter.fetchAssignedIssues("board-1");
      expect(issues[0].providerUpdatedAt).toEqual(new Date("2026-04-02T08:30:00.000Z"));
    });

    it("sends correct query params including idBoards filter", async () => {
      mockGet
        .mockResolvedValueOnce({ data: MEMBER_ME })
        .mockResolvedValueOnce({ data: [] });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      await adapter.fetchAssignedIssues("board-1");

      const cardCall = (mockGet.mock.calls as unknown[][]).find(
        (call) => (call[0] as string).includes("/cards"),
      );
      const callParams = (cardCall![1] as { params: Record<string, unknown> }).params;
      expect(callParams.filter).toBe("open");
      expect(callParams.idBoards).toBe("board-1");
    });

    it("returns empty array when no assigned cards exist", async () => {
      mockGet
        .mockResolvedValueOnce({ data: MEMBER_ME })
        .mockResolvedValueOnce({ data: [UNASSIGNED_CARD] });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      const issues = await adapter.fetchAssignedIssues("board-1");
      expect(issues).toEqual([]);
    });

    it("uses cached member ID from previous call", async () => {
      mockGet
        .mockResolvedValueOnce({ data: MEMBER_ME })
        .mockResolvedValueOnce({ data: [SAMPLE_CARD] })
        .mockResolvedValueOnce({ data: [SAMPLE_CARD] });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      await adapter.fetchAssignedIssues("board-1");
      await adapter.fetchAssignedIssues("board-1");

      const meCalls = (mockGet.mock.calls as unknown[][]).filter(
        (call) => call[0] === "/members/me",
      );
      expect(meCalls).toHaveLength(1);
    });
  });

  // ─── fetchUnassignedIssues ─────────────────────────────────────────────────

  describe("fetchUnassignedIssues", () => {
    it("returns only cards with empty idMembers and sets isUnassigned=true", async () => {
      mockGet.mockResolvedValueOnce({ data: [SAMPLE_CARD, UNASSIGNED_CARD] });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      const issues = await adapter.fetchUnassignedIssues("board-1");

      expect(issues).toHaveLength(1);
      expect(issues[0].externalId).toBe("card-2");
      expect(issues[0].isUnassigned).toBe(true);
    });

    it("uses board cards endpoint (GET /1/boards/{id}/cards)", async () => {
      mockGet.mockResolvedValueOnce({ data: [] });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      await adapter.fetchUnassignedIssues("board-1");

      expect(mockGet).toHaveBeenCalledWith(
        "/boards/board-1/cards",
        expect.objectContaining({
          params: expect.objectContaining({
            filter: "open",
          }),
        }),
      );
    });

    it("maps NormalizedIssue fields correctly for unassigned card", async () => {
      mockGet.mockResolvedValueOnce({ data: [UNASSIGNED_CARD] });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      const issues = await adapter.fetchUnassignedIssues("board-1");

      expect(issues[0]).toEqual({
        externalId: "card-2",
        title: "Unassigned task",
        dueDate: null,
        externalUrl: "https://trello.com/c/def456/unassigned-task",
        isUnassigned: true,
        providerCreatedAt: null,
        providerUpdatedAt: new Date("2026-04-01T12:00:00.000Z"),
      });
    });

    it("handles null due date", async () => {
      mockGet.mockResolvedValueOnce({ data: [UNASSIGNED_CARD] });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      const issues = await adapter.fetchUnassignedIssues("board-1");
      expect(issues[0].dueDate).toBeNull();
    });

    it("filters out assigned cards", async () => {
      mockGet.mockResolvedValueOnce({ data: [SAMPLE_CARD] });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      const issues = await adapter.fetchUnassignedIssues("board-1");
      expect(issues).toEqual([]);
    });

    it("returns empty array when no unassigned cards exist", async () => {
      mockGet.mockResolvedValueOnce({ data: [SAMPLE_CARD] });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      const issues = await adapter.fetchUnassignedIssues("board-1");
      expect(issues).toEqual([]);
    });

    it("throws when API returns an error", async () => {
      mockGet.mockRejectedValue(new Error("API Error"));

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      await expect(adapter.fetchUnassignedIssues("board-1")).rejects.toThrow("API Error");
    });
  });

  // ─── closeIssue ───────────────────────────────────────────────────────────

  describe("closeIssue", () => {
    it("calls PUT /cards/{cardId} with closed=true", async () => {
      mockPut.mockResolvedValue({ data: { id: "card-1" } });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      await expect(adapter.closeIssue("board-1", "card-1")).resolves.toBeUndefined();

      expect(mockPut).toHaveBeenCalledWith(
        "/cards/card-1",
        expect.objectContaining({ closed: true }),
      );
    });

    it("ignores the projectExternalId parameter", async () => {
      mockPut.mockResolvedValue({ data: { id: "card-1" } });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      await adapter.closeIssue("any-project", "card-42");

      expect(mockPut).toHaveBeenCalledWith(
        "/cards/card-42",
        expect.objectContaining({ closed: true }),
      );
    });

    it("throws when PUT fails", async () => {
      mockPut.mockRejectedValue(new Error("Forbidden"));

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      await expect(adapter.closeIssue("board-1", "card-1")).rejects.toThrow("Forbidden");
    });
  });

  // ─── addComment ───────────────────────────────────────────────────────────

  describe("addComment", () => {
    it("calls POST /cards/{cardId}/actions/comments with text", async () => {
      mockPost.mockResolvedValue({ data: { id: "action-1" } });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      await expect(adapter.addComment("board-1", "card-1", "Great work!")).resolves.toBeUndefined();

      expect(mockPost).toHaveBeenCalledWith(
        "/cards/card-1/actions/comments",
        expect.objectContaining({ text: "Great work!" }),
      );
    });

    it("ignores the projectExternalId parameter", async () => {
      mockPost.mockResolvedValue({ data: { id: "action-1" } });

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      await adapter.addComment("any-project", "card-99", "comment text");

      expect(mockPost).toHaveBeenCalledWith(
        "/cards/card-99/actions/comments",
        expect.objectContaining({ text: "comment text" }),
      );
    });

    it("throws when POST fails", async () => {
      mockPost.mockRejectedValue(new Error("Server Error"));

      const adapter = new TrelloAdapter("valid-key", "valid-token");
      await expect(adapter.addComment("board-1", "card-1", "hi")).rejects.toThrow("Server Error");
    });
  });
});
