/** @jest-environment node */
import { PATCH } from "@/app/api/issues/[id]/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({
  prisma: {
    issue: {
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));
jest.mock("@/lib/encryption", () => ({
  decrypt: jest.fn().mockReturnValue(JSON.stringify({ token: "test" })),
}));
jest.mock("@/services/issue-provider/factory", () => ({
  createAdapter: jest.fn().mockReturnValue({
    closeIssue: jest.fn().mockResolvedValue(undefined),
    reopenIssue: jest.fn().mockResolvedValue(undefined),
  }),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockAuth = auth as jest.Mock;
const mockFindFirst = prisma.issue.findFirst as jest.Mock;
const mockUpdate = prisma.issue.update as jest.Mock;
const mockCount = prisma.issue.count as jest.Mock;
const mockTransaction = prisma.$transaction as jest.Mock;

const SESSION = { user: { id: "user-1", email: "u@example.com", role: "USER" } };

const MOCK_ISSUE = {
  id: "issue-1",
  externalId: "42",
  status: "OPEN",
  todayFlag: false,
  todayOrder: null,
  todayAddedAt: null,
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

function makeRequest(id: string, body: object): NextRequest {
  return new NextRequest(`http://localhost/api/issues/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/issues/[id] — todayFlag", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
    mockCount.mockResolvedValue(0);
    mockTransaction.mockImplementation(
      async (fn: (tx: { issue: { count: jest.Mock; update: jest.Mock } }) => Promise<unknown>) =>
        fn({ issue: { count: mockCount, update: mockUpdate } })
    );
  });

  it("returns 200 and sets todayFlag true with todayOrder and todayAddedAt", async () => {
    mockFindFirst.mockResolvedValue(MOCK_ISSUE);
    const now = new Date();
    mockUpdate.mockResolvedValue({
      id: "issue-1",
      todayFlag: true,
      todayOrder: 1,
      todayAddedAt: now,
    });

    const req = makeRequest("issue-1", { todayFlag: true });
    const res = await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.todayFlag).toBe(true);
    expect(json.data.todayOrder).toBe(1);
    expect(json.data.todayAddedAt).toBeDefined();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          todayFlag: true,
          todayAddedAt: expect.any(Date),
        }),
      })
    );
  });

  it("returns 200 and clears todayOrder/todayAddedAt when todayFlag set to false", async () => {
    const existing = { ...MOCK_ISSUE, todayFlag: true, todayOrder: 1, todayAddedAt: new Date() };
    mockFindFirst.mockResolvedValue(existing);
    mockUpdate.mockResolvedValue({ id: "issue-1", todayFlag: false, todayOrder: null, todayAddedAt: null });

    const req = makeRequest("issue-1", { todayFlag: false });
    const res = await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.todayFlag).toBe(false);
    expect(json.data.todayOrder).toBeNull();
    expect(json.data.todayAddedAt).toBeNull();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { todayFlag: false, todayOrder: null, todayAddedAt: null },
      })
    );
  });

  it("assigns todayOrder = existing today count + 1 when adding to today", async () => {
    mockFindFirst.mockResolvedValue(MOCK_ISSUE);
    mockCount.mockResolvedValue(3);
    mockUpdate.mockResolvedValue({ id: "issue-1", todayFlag: true, todayOrder: 4, todayAddedAt: new Date() });

    const req = makeRequest("issue-1", { todayFlag: true });
    const res = await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ todayOrder: 4 }),
      })
    );
  });

  it("returns 400 when trying to set todayFlag=true on a CLOSED issue", async () => {
    mockFindFirst.mockResolvedValue({ ...MOCK_ISSUE, status: "CLOSED" });

    const req = makeRequest("issue-1", { todayFlag: true });
    const res = await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });

    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const req = makeRequest("issue-1", { todayFlag: true });
    const res = await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });

    expect(res.status).toBe(401);
  });

  it("returns 403 when issue belongs to different user", async () => {
    mockFindFirst.mockResolvedValue(null);

    const req = makeRequest("issue-1", { todayFlag: true });
    const res = await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });

    expect(res.status).toBe(403);
  });
});
