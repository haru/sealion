/** @jest-environment node */
import { PATCH } from "@/app/api/issues/[id]/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db/db", () => ({
  prisma: {
    issue: { findFirst: jest.fn(), update: jest.fn(), deleteMany: jest.fn(), count: jest.fn() },
    project: { findFirst: jest.fn() },
    $transaction: jest.fn().mockImplementation((fn) => fn(prisma)),
  },
}));
jest.mock("@/lib/encryption/encryption", () => ({ decrypt: jest.fn().mockReturnValue(JSON.stringify({ token: "test" })) }));
jest.mock("@/services/issue-provider/factory", () => ({
  createAdapter: jest.fn().mockReturnValue({
    closeIssue: jest.fn().mockResolvedValue(undefined),
    addComment: jest.fn().mockResolvedValue(undefined),
  }),
}));

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/db";

const mockAuth = auth as jest.Mock;
const mockFindFirst = prisma.issue.findFirst as jest.Mock;
const mockUpdate = prisma.issue.update as jest.Mock;
const mockDeleteMany = prisma.issue.deleteMany as jest.Mock;
const mockCount = prisma.issue.count as jest.Mock;

const SESSION = { user: { id: "user-1", email: "u@example.com", role: "USER" } };

function makeRequest(id: string, body: object): NextRequest {
  return new NextRequest(`http://localhost/api/issues/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const CLOSE_ISSUE = {
  id: "issue-1",
  externalId: "42",
  project: {
    id: "project-1",
    externalId: "owner/repo",
    issueProvider: {
      type: "GITHUB",
      encryptedCredentials: "encrypted",
      userId: "user-1",
    },
  },
};

describe("PATCH /api/issues/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  describe("pin toggle", () => {
    it("returns 200 with { id, pinned: true } on happy path", async () => {
      mockFindFirst.mockResolvedValue({ id: "issue-1" });
      mockUpdate.mockResolvedValue({ id: "issue-1", pinned: true });

      const res = await PATCH(makeRequest("issue-1", { pinned: true }), {
        params: Promise.resolve({ id: "issue-1" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toEqual({ id: "issue-1", pinned: true });
    });

    it("returns 403 when issue not found or not owned by user", async () => {
      mockFindFirst.mockResolvedValue(null);

      const res = await PATCH(makeRequest("issue-1", { pinned: true }), {
        params: Promise.resolve({ id: "issue-1" }),
      });

      expect(res.status).toBe(403);
    });

    it("returns 404 when issue is concurrently deleted during update (P2025)", async () => {
      mockFindFirst.mockResolvedValue({ id: "issue-1" });
      mockUpdate.mockRejectedValue({ code: "P2025" });

      const res = await PATCH(makeRequest("issue-1", { pinned: true }), {
        params: Promise.resolve({ id: "issue-1" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 400 when pinned is not a boolean", async () => {
      const res = await PATCH(makeRequest("issue-1", { pinned: "true" }), {
        params: Promise.resolve({ id: "issue-1" }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("INVALID_INPUT");
    });
  });

  describe("today flag", () => {
    it("returns 200 with today flag set on happy path", async () => {
      mockFindFirst.mockResolvedValue({
        id: "issue-1",
        todayFlag: false,
        todayOrder: null,
        todayAddedAt: null,
      });
      mockCount.mockResolvedValue(3);
      mockUpdate.mockResolvedValue({
        id: "issue-1",
        todayFlag: true,
        todayOrder: 4,
        todayAddedAt: new Date("2026-03-27T12:00:00Z"),
      });

      const res = await PATCH(makeRequest("issue-1", { todayFlag: true }), {
        params: Promise.resolve({ id: "issue-1" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.id).toBe("issue-1");
      expect(json.data.todayFlag).toBe(true);
      expect(json.data.todayOrder).toBe(4);
      expect(json.data.todayAddedAt).toBeTruthy();
    });

    it("returns current state without changing order when already flagged (idempotency)", async () => {
      const addedAt = new Date("2026-03-27T10:00:00Z");
      mockFindFirst.mockResolvedValue({
        id: "issue-1",
        todayFlag: true,
        todayOrder: 2,
        todayAddedAt: addedAt,
      });

      const res = await PATCH(makeRequest("issue-1", { todayFlag: true }), {
        params: Promise.resolve({ id: "issue-1" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.id).toBe("issue-1");
      expect(json.data.todayFlag).toBe(true);
      expect(json.data.todayOrder).toBe(2);
      expect(json.data.todayAddedAt).toBe(addedAt.toISOString());
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("close issue", () => {
    it("returns 200 on happy path", async () => {
      mockFindFirst.mockResolvedValue(CLOSE_ISSUE);
      mockDeleteMany.mockResolvedValue({ count: 1 });

      const res = await PATCH(makeRequest("issue-1", { closed: true }), {
        params: Promise.resolve({ id: "issue-1" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.id).toBe("issue-1");
    });

    it("returns 403 when issue not found or not owned by user", async () => {
      mockFindFirst.mockResolvedValue(null);

      const res = await PATCH(makeRequest("issue-1", { closed: true }), {
        params: Promise.resolve({ id: "issue-1" }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("input validation", () => {
    it("returns 400 when request body is invalid JSON", async () => {
      const req = new NextRequest("http://localhost/api/issues/issue-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "not valid json{{{",
      });
      const res = await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("INVALID_BODY");
    });

    it("returns 400 when body contains no recognized keys", async () => {
      const res = await PATCH(makeRequest("issue-1", { foo: "bar" }), {
        params: Promise.resolve({ id: "issue-1" }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("INVALID_BODY");
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await PATCH(makeRequest("issue-1", { pinned: true }), {
      params: Promise.resolve({ id: "issue-1" }),
    });

    expect(res.status).toBe(401);
  });
});
