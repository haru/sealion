/** @jest-environment node */
import { PATCH } from "@/app/api/issues/[id]/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/db", () => ({
  prisma: {
    issue: {
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));
jest.mock("@/lib/encryption", () => ({
  decrypt: jest.fn().mockReturnValue(JSON.stringify({ token: "test" })),
}));
jest.mock("@/services/issue-provider/factory", () => ({
  createAdapter: jest.fn().mockReturnValue({
    closeIssue: jest.fn().mockResolvedValue(undefined),
  }),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const mockAuth = auth as jest.Mock;
const mockFindFirst = prisma.issue.findFirst as jest.Mock;
const mockDeleteMany = prisma.issue.deleteMany as jest.Mock;

const SESSION = { user: { id: "user-1", email: "u@example.com", role: "USER" } };

const MOCK_ISSUE = {
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

  it("returns 200 and deletes issue on success", async () => {
    mockFindFirst.mockResolvedValue(MOCK_ISSUE);
    mockDeleteMany.mockResolvedValue({ count: 1 });

    const req = makeRequest("issue-1", { closed: true });
    const res = await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.id).toBe("issue-1");
    expect(mockDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "issue-1" } })
    );
  });

  it("returns 502 and does not delete from DB when external call fails", async () => {
    mockFindFirst.mockResolvedValue(MOCK_ISSUE);

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    createAdapter.mockReturnValueOnce({
      closeIssue: jest.fn().mockRejectedValue(new Error("External failure")),
    });

    const req = makeRequest("issue-1", { closed: true });
    const res = await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });

    expect(res.status).toBe(502);
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("returns 403 when issue belongs to different user", async () => {
    mockFindFirst.mockResolvedValue(null);

    const req = makeRequest("issue-1", { closed: true });
    const res = await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });

    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const req = makeRequest("issue-1", { closed: true });
    const res = await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });

    expect(res.status).toBe(401);
  });

  it("returns 400 when closed is false", async () => {
    const req = makeRequest("issue-1", { closed: false });
    const res = await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_INPUT");
  });

  it("returns 404 when issue was already deleted by concurrent request", async () => {
    mockFindFirst.mockResolvedValue(MOCK_ISSUE);
    mockDeleteMany.mockResolvedValue({ count: 0 });

    const req = makeRequest("issue-1", { closed: true });
    const res = await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });

    expect(res.status).toBe(404);
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
    mockDeleteMany.mockResolvedValue({ count: 1 });

    const { createAdapter } = jest.requireMock("@/services/issue-provider/factory");
    const req = makeRequest("issue-1", { closed: true });
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

    const req = makeRequest("issue-1", { closed: true });
    const res = await PATCH(req, { params: Promise.resolve({ id: "issue-1" }) });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_CREDENTIALS");
  });
});
