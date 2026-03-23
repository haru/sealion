/** @jest-environment node */
import { PATCH } from "@/app/api/issues/[id]/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({
  prisma: {
    issue: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
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

const SESSION = { user: { id: "user-1", email: "u@example.com", role: "USER" } };

const MOCK_ISSUE = {
  id: "issue-1",
  externalId: "42",
  status: "OPEN",
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

describe("PATCH /api/issues/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(SESSION);
  });

  it("returns 200 and updates status on success", async () => {
    mockFindFirst.mockResolvedValue(MOCK_ISSUE);
    mockUpdate.mockResolvedValue({ ...MOCK_ISSUE, status: "CLOSED" });

    const req = makeRequest("issue-1", { status: "CLOSED" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "CLOSED", todayFlag: false, todayOrder: null, todayAddedAt: null },
      })
    );
  });

  it("clears today fields when closing an issue that was marked for today", async () => {
    const todayIssue = {
      ...MOCK_ISSUE,
      todayFlag: true,
      todayOrder: 2,
      todayAddedAt: new Date(),
    };
    mockFindFirst.mockResolvedValue(todayIssue);
    mockUpdate.mockResolvedValue({ id: "issue-1", status: "CLOSED", todayFlag: false, todayOrder: null, todayAddedAt: null });

    const req = makeRequest("issue-1", { status: "CLOSED" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "CLOSED", todayFlag: false, todayOrder: null, todayAddedAt: null },
      })
    );
  });

  it("returns 502 and does not update DB when external call fails", async () => {
    mockFindFirst.mockResolvedValue(MOCK_ISSUE);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    createAdapter.mockReturnValueOnce({
      closeIssue: jest.fn().mockRejectedValue(new Error("External failure")),
    });

    const req = makeRequest("issue-1", { status: "CLOSED" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });

    expect(res.status).toBe(502);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 403 when issue belongs to different user", async () => {
    mockFindFirst.mockResolvedValue(null);

    const req = makeRequest("issue-1", { status: "CLOSED" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });

    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const req = makeRequest("issue-1", { status: "CLOSED" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });

    expect(res.status).toBe(401);
  });

  it("passes baseUrl from issueProvider to createAdapter for Jira", async () => {
    const jiraIssue = {
      ...MOCK_ISSUE,
      project: {
        ...MOCK_ISSUE.project,
        issueProvider: {
          type: "JIRA",
          encryptedCredentials: "encrypted",
          baseUrl: "https://example.atlassian.net",
          userId: "user-1",
        },
      },
    };
    mockFindFirst.mockResolvedValue(jiraIssue);
    mockUpdate.mockResolvedValue({ id: "issue-1", status: "CLOSED" });

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    const req = makeRequest("issue-1", { status: "CLOSED" });
    await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });

    expect(createAdapter).toHaveBeenCalledWith(
      "JIRA",
      expect.objectContaining({ baseUrl: "https://example.atlassian.net" })
    );
  });

  it("returns 400 when credential decryption fails", async () => {
    mockFindFirst.mockResolvedValue(MOCK_ISSUE);
    const { decrypt } = jest.requireMock("@/lib/encryption");
    decrypt.mockImplementationOnce(() => { throw new Error("Decryption failed"); });

    const req = makeRequest("issue-1", { status: "CLOSED" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_CREDENTIALS");
  });
});
