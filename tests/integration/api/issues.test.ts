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
import { encrypt } from "@/lib/encryption/encryption";

const TEST_USER_ID = "issues-integration-test-user";
const VALID_KEY = "b".repeat(64);

process.env.CREDENTIALS_ENCRYPTION_KEY = VALID_KEY;

jest.mock("@/lib/auth/auth", () => ({
  auth: jest.fn().mockResolvedValue({
    user: { id: TEST_USER_ID, email: "issues-test@integration.com", role: "USER" },
  }),
}));

const mockCloseIssue = jest.fn().mockResolvedValue(undefined);
const mockAddComment = jest.fn().mockResolvedValue(undefined);

jest.mock("@/services/issue-provider/github/github", () => ({
  GitHubAdapter: Object.assign(
    jest.fn().mockImplementation(() => ({
      closeIssue: mockCloseIssue,
      addComment: mockAddComment,
    })),
    { iconUrl: "/github.svg" }
  ),
}));

jest.mock("@/services/issue-provider/jira/jira", () => ({
  JiraAdapter: Object.assign(
    jest.fn().mockImplementation(() => ({
      closeIssue: mockCloseIssue,
      addComment: mockAddComment,
    })),
    { iconUrl: "/jira.svg" }
  ),
}));

jest.mock("@/services/issue-provider/redmine/redmine", () => ({
  RedmineAdapter: Object.assign(
    jest.fn().mockImplementation(() => ({
      closeIssue: mockCloseIssue,
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
      passwordHash: "hashed",
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
      externalUrl: "https://github.com/owner/repo/issues/99",
    },
  });

  return issue.id;
}

async function importIssueIdRoute(p: unknown) {
  jest.resetModules();
  jest.doMock("@/lib/db/db", () => ({ prisma: p }));
  jest.doMock("@/lib/auth/auth", () => ({
    auth: jest.fn().mockResolvedValue({
      user: { id: TEST_USER_ID, email: "issues-test@integration.com", role: "USER" },
    }),
  }));
  jest.doMock("@/services/issue-provider/github/github", () => ({
    GitHubAdapter: Object.assign(
      jest.fn().mockImplementation(() => ({
        closeIssue: mockCloseIssue,
        addComment: mockAddComment,
      })),
      { iconUrl: "/github.svg" }
    ),
  }));
  jest.doMock("@/services/issue-provider/jira/jira", () => ({
    JiraAdapter: Object.assign(
      jest.fn().mockImplementation(() => ({
        closeIssue: mockCloseIssue,
        addComment: mockAddComment,
      })),
      { iconUrl: "/jira.svg" }
    ),
  }));
  jest.doMock("@/services/issue-provider/redmine/redmine", () => ({
    RedmineAdapter: Object.assign(
      jest.fn().mockImplementation(() => ({
        closeIssue: mockCloseIssue,
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

describe("PATCH /api/issues/[id] — pinned toggle", () => {
  it("returns 200 with { id, pinned: true } when pinned is set to true", async () => {
    if (!dbAvailable) return;

    const issueId = await seedTestIssue();
    const { PATCH } = await importIssueIdRoute(prisma);

    const req = new NextRequest(`http://localhost/api/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify({ pinned: true }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: issueId }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.id).toBe(issueId);
    expect(json.data.pinned).toBe(true);

    // Verify persisted in DB
    const updated = await prisma.issue.findUnique({ where: { id: issueId } });
    expect(updated?.pinned).toBe(true);
  });

  it("returns 200 with { id, pinned: false } when pinned is set to false", async () => {
    if (!dbAvailable) return;

    const issueId = await seedTestIssue();
    // Seed with pinned=true first
    await prisma.issue.update({ where: { id: issueId }, data: { pinned: true } });

    const { PATCH } = await importIssueIdRoute(prisma);

    const req = new NextRequest(`http://localhost/api/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify({ pinned: false }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: issueId }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.id).toBe(issueId);
    expect(json.data.pinned).toBe(false);

    const updated = await prisma.issue.findUnique({ where: { id: issueId } });
    expect(updated?.pinned).toBe(false);
  });

  it("returns 401 when not authenticated", async () => {
    if (!dbAvailable) return;

    jest.resetModules();
    jest.doMock("@/lib/db/db", () => ({ prisma }));
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue(null),
    }));
    const { PATCH } = await import("@/app/api/issues/[id]/route");

    const req = new NextRequest(`http://localhost/api/issues/nonexistent`, {
      method: "PATCH",
      body: JSON.stringify({ pinned: true }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(res.status).toBe(401);
  });

  it("returns 403 when issue belongs to a different user", async () => {
    if (!dbAvailable) return;

    const issueId = await seedTestIssue();

    // Import with a different user ID
    jest.resetModules();
    jest.doMock("@/lib/db/db", () => ({ prisma }));
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: "different-user-id", email: "other@test.com", role: "USER" },
      }),
    }));
    jest.doMock("@/services/issue-provider/github/github", () => ({
      GitHubAdapter: Object.assign(jest.fn().mockImplementation(() => ({})), { iconUrl: "/github.svg" }),
    }));
    jest.doMock("@/services/issue-provider/jira/jira", () => ({
      JiraAdapter: Object.assign(jest.fn().mockImplementation(() => ({})), { iconUrl: "/jira.svg" }),
    }));
    jest.doMock("@/services/issue-provider/redmine/redmine", () => ({
      RedmineAdapter: Object.assign(jest.fn().mockImplementation(() => ({})), { iconUrl: "/redmine.svg" }),
    }));
    const { PATCH } = await import("@/app/api/issues/[id]/route");

    const req = new NextRequest(`http://localhost/api/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify({ pinned: true }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: issueId }) });

    expect(res.status).toBe(403);
  });

  it("returns 400 when pinned is not a boolean", async () => {
    if (!dbAvailable) return;

    const issueId = await seedTestIssue();
    const { PATCH } = await importIssueIdRoute(prisma);

    const req = new NextRequest(`http://localhost/api/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify({ pinned: "yes" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: issueId }) });

    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/issues/[id] — unpin direction (US2)", () => {
  it("returns 200 with pinned: false after unpinning a previously pinned issue", async () => {
    if (!dbAvailable) return;

    const issueId = await seedTestIssue();
    await prisma.issue.update({ where: { id: issueId }, data: { pinned: true } });

    const { PATCH } = await importIssueIdRoute(prisma);

    const req = new NextRequest(`http://localhost/api/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify({ pinned: false }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: issueId }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.pinned).toBe(false);
  });

  it("client must not persist the change when PATCH returns 400 (non-boolean)", async () => {
    if (!dbAvailable) return;

    const issueId = await seedTestIssue();
    await prisma.issue.update({ where: { id: issueId }, data: { pinned: true } });

    const { PATCH } = await importIssueIdRoute(prisma);

    const req = new NextRequest(`http://localhost/api/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify({ pinned: "false" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: issueId }) });
    expect(res.status).toBe(400);

    // Verify pinned state was NOT changed in DB (rollback contract)
    const unchanged = await prisma.issue.findUnique({ where: { id: issueId } });
    expect(unchanged?.pinned).toBe(true);
  });
});

describe("PATCH /api/issues/[id] — status update", () => {
  it("closes issue without comment when comment is omitted", async () => {
    if (!dbAvailable) return;

    const issueId = await seedTestIssue();
    const { PATCH } = await importIssueIdRoute(prisma);

    const req = new NextRequest(`http://localhost/api/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify({ closed: true }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: issueId }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.id).toBe(issueId);
    expect(mockCloseIssue).toHaveBeenCalledTimes(1);
    expect(mockAddComment).not.toHaveBeenCalled();
  });

  it("closes issue AND posts comment when non-empty comment is provided", async () => {
    if (!dbAvailable) return;

    const issueId = await seedTestIssue();
    const { PATCH } = await importIssueIdRoute(prisma);

    const req = new NextRequest(`http://localhost/api/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify({ closed: true, comment: "Completed after review." }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: issueId }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.id).toBe(issueId);
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
      body: JSON.stringify({ closed: true, comment: "" }),
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
      body: JSON.stringify({ closed: true, comment: "   " }),
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
      body: JSON.stringify({ closed: true, comment: "A comment that will fail" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: issueId }) });

    expect(res.status).toBe(502);
  });
});
