/** @jest-environment node */
/**
 * Integration test: PATCH /api/issues/[id] — status update with optional comment.
 * Uses real Prisma against test database.
 *
 * Prerequisites:
 *   - DATABASE_URL environment variable pointing to test DB
 *   - CREDENTIALS_ENCRYPTION_KEY set (64-char hex)
 *   - DB migrated: npx prisma migrate deploy
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { encrypt } from "@/lib/encryption";

const TEST_USER_ID = "issues-integration-test-user";
const VALID_KEY = "b".repeat(64);

process.env.CREDENTIALS_ENCRYPTION_KEY = VALID_KEY;

jest.mock("@/lib/auth", () => ({
  auth: jest.fn().mockResolvedValue({
    user: { id: TEST_USER_ID, email: "issues-test@integration.com", role: "USER" },
  }),
}));

const mockCloseIssue = jest.fn().mockResolvedValue(undefined);
const mockReopenIssue = jest.fn().mockResolvedValue(undefined);
const mockAddComment = jest.fn().mockResolvedValue(undefined);

jest.mock("@/services/issue-provider/github", () => ({
  GitHubAdapter: Object.assign(
    jest.fn().mockImplementation(() => ({
      closeIssue: mockCloseIssue,
      reopenIssue: mockReopenIssue,
      addComment: mockAddComment,
    })),
    { iconUrl: "/github.svg" }
  ),
}));

jest.mock("@/services/issue-provider/jira", () => ({
  JiraAdapter: Object.assign(
    jest.fn().mockImplementation(() => ({
      closeIssue: mockCloseIssue,
      reopenIssue: mockReopenIssue,
      addComment: mockAddComment,
    })),
    { iconUrl: "/jira.svg" }
  ),
}));

jest.mock("@/services/issue-provider/redmine", () => ({
  RedmineAdapter: Object.assign(
    jest.fn().mockImplementation(() => ({
      closeIssue: mockCloseIssue,
      reopenIssue: mockReopenIssue,
      addComment: mockAddComment,
    })),
    { iconUrl: "/redmine.svg" }
  ),
}));

let prisma: PrismaClient;
let dbAvailable = false;

/** Creates a test user, provider, project, and issue. Returns the issue ID. */
async function seedTestIssue(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: {
      id: TEST_USER_ID,
      email: "issues-test@integration.com",
      hashedPassword: "hashed",
      role: "USER",
    },
  });

  const credentials = encrypt(JSON.stringify({ token: "test-token" }));
  const provider = await prisma.issueProvider.create({
    data: {
      userId: user.id,
      type: "GITHUB",
      displayName: "Test GitHub",
      encryptedCredentials: credentials,
    },
  });

  const project = await prisma.project.create({
    data: {
      issueProviderId: provider.id,
      externalId: "owner/repo",
      displayName: "owner/repo",
    },
  });

  const issue = await prisma.issue.create({
    data: {
      projectId: project.id,
      externalId: "99",
      title: "Test issue for PATCH",
      status: "OPEN",
      externalUrl: "https://github.com/owner/repo/issues/99",
    },
  });

  return issue.id;
}

async function importIssueIdRoute(p: unknown) {
  jest.resetModules();
  jest.doMock("@/lib/db", () => ({ prisma: p }));
  jest.doMock("@/lib/auth", () => ({
    auth: jest.fn().mockResolvedValue({
      user: { id: TEST_USER_ID, email: "issues-test@integration.com", role: "USER" },
    }),
  }));
  jest.doMock("@/services/issue-provider/github", () => ({
    GitHubAdapter: Object.assign(
      jest.fn().mockImplementation(() => ({
        closeIssue: mockCloseIssue,
        reopenIssue: mockReopenIssue,
        addComment: mockAddComment,
      })),
      { iconUrl: "/github.svg" }
    ),
  }));
  jest.doMock("@/services/issue-provider/jira", () => ({
    JiraAdapter: Object.assign(
      jest.fn().mockImplementation(() => ({
        closeIssue: mockCloseIssue,
        reopenIssue: mockReopenIssue,
        addComment: mockAddComment,
      })),
      { iconUrl: "/jira.svg" }
    ),
  }));
  jest.doMock("@/services/issue-provider/redmine", () => ({
    RedmineAdapter: Object.assign(
      jest.fn().mockImplementation(() => ({
        closeIssue: mockCloseIssue,
        reopenIssue: mockReopenIssue,
        addComment: mockAddComment,
      })),
      { iconUrl: "/redmine.svg" }
    ),
  }));
  return await import("@/app/api/issues/[id]/route");
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set — skipping issues integration tests");
    return;
  }
  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();
    dbAvailable = true;
  } catch {
    console.warn("DB unavailable — skipping issues integration tests");
  }
});

afterAll(async () => {
  if (prisma) {
    await prisma.issue.deleteMany({ where: { project: { issueProvider: { userId: TEST_USER_ID } } } });
    await prisma.project.deleteMany({ where: { issueProvider: { userId: TEST_USER_ID } } });
    await prisma.issueProvider.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
    await prisma.$disconnect();
  }
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PATCH /api/issues/[id] — status update", () => {
  it("closes issue without comment when comment is omitted (backward compat)", async () => {
    if (!dbAvailable) return;

    const issueId = await seedTestIssue();
    const { PATCH } = await importIssueIdRoute(prisma);

    const req = new NextRequest(`http://localhost/api/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "CLOSED" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: issueId }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe("CLOSED");
    expect(mockCloseIssue).toHaveBeenCalledTimes(1);
    expect(mockAddComment).not.toHaveBeenCalled();
  });

  it("closes issue AND posts comment when non-empty comment is provided", async () => {
    if (!dbAvailable) return;

    const issueId = await seedTestIssue();
    const { PATCH } = await importIssueIdRoute(prisma);

    const req = new NextRequest(`http://localhost/api/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "CLOSED", comment: "Completed after review." }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: issueId }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe("CLOSED");
    expect(mockCloseIssue).toHaveBeenCalledTimes(1);
    expect(mockAddComment).toHaveBeenCalledTimes(1);
    expect(mockAddComment).toHaveBeenCalledWith(
      "owner/repo",
      "99",
      "Completed after review."
    );
  });

  it("closes issue without posting comment when comment is an empty string", async () => {
    if (!dbAvailable) return;

    const issueId = await seedTestIssue();
    const { PATCH } = await importIssueIdRoute(prisma);

    const req = new NextRequest(`http://localhost/api/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "CLOSED", comment: "" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: issueId }) });

    expect(res.status).toBe(200);
    expect(mockCloseIssue).toHaveBeenCalledTimes(1);
    expect(mockAddComment).not.toHaveBeenCalled();
  });

  it("closes issue without posting comment when comment is whitespace-only", async () => {
    if (!dbAvailable) return;

    const issueId = await seedTestIssue();
    const { PATCH } = await importIssueIdRoute(prisma);

    const req = new NextRequest(`http://localhost/api/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "CLOSED", comment: "   " }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: issueId }) });

    expect(res.status).toBe(200);
    expect(mockCloseIssue).toHaveBeenCalledTimes(1);
    expect(mockAddComment).not.toHaveBeenCalled();
  });

  it("returns 502 when addComment fails after successful close", async () => {
    if (!dbAvailable) return;

    mockAddComment.mockRejectedValueOnce(new Error("Provider API error"));
    const issueId = await seedTestIssue();
    const { PATCH } = await importIssueIdRoute(prisma);

    const req = new NextRequest(`http://localhost/api/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "CLOSED", comment: "A comment that will fail" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: issueId }) });

    expect(res.status).toBe(502);
  });
});
