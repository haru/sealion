/** @jest-environment node */
/**
 * Integration tests for GET /api/issues with search and filter parameters.
 * Covers: keyword search (q), provider filter, project filter, assignee filter,
 * date range filters, combined filters, and pagination compatibility.
 *
 * Prerequisites:
 *   - DATABASE_URL pointing to test DB
 *   - CREDENTIALS_ENCRYPTION_KEY set (64-char hex)
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { encrypt } from "@/lib/encryption";

const TEST_USER_ID = "issues-search-integration-user";
const VALID_KEY = "c".repeat(64);

process.env.CREDENTIALS_ENCRYPTION_KEY = VALID_KEY;

jest.mock("@/lib/auth", () => ({
  auth: jest.fn().mockResolvedValue({
    user: { id: TEST_USER_ID, email: "issues-search@integration.com", role: "USER" },
  }),
}));

let prisma: PrismaClient;
let dbAvailable = false;

/** IDs of seeded data for cleanup */
let seededProviderGithubId: string;
let seededProviderJiraId: string;
let seededProjectAlphaId: string;
let seededProjectBetaId: string;

/**
 * Creates a minimal provider + project + issues fixture.
 * Two providers (GITHUB, JIRA), two projects, several issues with varied attributes.
 */
async function seedSearchFixtures() {
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: {
      id: TEST_USER_ID,
      email: "issues-search@integration.com",
      passwordHash: "hashed",
      role: "USER",
    },
  });

  const creds = encrypt(JSON.stringify({ token: "test-token" }));

  const githubProvider = await prisma.issueProvider.create({
    data: {
      userId: TEST_USER_ID,
      type: "GITHUB",
      displayName: "GitHub Test",
      encryptedCredentials: creds,
    },
  });
  seededProviderGithubId = githubProvider.id;

  const jiraProvider = await prisma.issueProvider.create({
    data: {
      userId: TEST_USER_ID,
      type: "JIRA",
      displayName: "Jira Test",
      encryptedCredentials: creds,
    },
  });
  seededProviderJiraId = jiraProvider.id;

  const projectAlpha = await prisma.project.create({
    data: {
      issueProviderId: githubProvider.id,
      externalId: "owner/alpha",
      displayName: "alpha-repo",
    },
  });
  seededProjectAlphaId = projectAlpha.id;

  const projectBeta = await prisma.project.create({
    data: {
      issueProviderId: jiraProvider.id,
      externalId: "BETA",
      displayName: "beta-project",
    },
  });
  seededProjectBetaId = projectBeta.id;

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // GitHub issues (alpha-repo)
  await prisma.issue.createMany({
    data: [
      {
        projectId: projectAlpha.id,
        externalId: "1",
        title: "Fix login bug",
        externalUrl: "https://github.com/owner/alpha/issues/1",
        isUnassigned: false,
        dueDate: now,
      },
      {
        projectId: projectAlpha.id,
        externalId: "2",
        title: "Improve performance",
        externalUrl: "https://github.com/owner/alpha/issues/2",
        isUnassigned: true,
        dueDate: nextWeek,
      },
      {
        projectId: projectAlpha.id,
        externalId: "3",
        title: "Update docs",
        externalUrl: "https://github.com/owner/alpha/issues/3",
        isUnassigned: true,
        dueDate: null,
      },
    ],
  });

  // Jira issues (beta-project)
  await prisma.issue.createMany({
    data: [
      {
        projectId: projectBeta.id,
        externalId: "BETA-1",
        title: "Bug in login flow",
        externalUrl: "https://jira.example.com/BETA-1",
        isUnassigned: false,
      },
      {
        projectId: projectBeta.id,
        externalId: "BETA-2",
        title: "Add search feature",
        externalUrl: "https://jira.example.com/BETA-2",
        isUnassigned: false,
      },
    ],
  });
}

async function importIssuesRoute(p: unknown) {
  jest.resetModules();
  jest.doMock("@/lib/db", () => ({ prisma: p }));
  jest.doMock("@/lib/auth", () => ({
    auth: jest.fn().mockResolvedValue({
      user: { id: TEST_USER_ID, email: "issues-search@integration.com", role: "USER" },
    }),
  }));
  jest.doMock("@/services/issue-provider/github", () => ({
    GitHubAdapter: Object.assign(jest.fn().mockImplementation(() => ({})), {
      iconUrl: "/github.svg",
    }),
  }));
  jest.doMock("@/services/issue-provider/jira", () => ({
    JiraAdapter: Object.assign(jest.fn().mockImplementation(() => ({})), { iconUrl: "/jira.svg" }),
  }));
  jest.doMock("@/services/issue-provider/redmine", () => ({
    RedmineAdapter: Object.assign(jest.fn().mockImplementation(() => ({})), {
      iconUrl: "/redmine.svg",
    }),
  }));
  return await import("@/app/api/issues/route");
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set — skipping issues-search integration tests");
    return;
  }
  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();
    dbAvailable = true;
    await seedSearchFixtures();
  } catch (err) {
    console.warn("DB unavailable — skipping issues-search integration tests", err);
  }
});

afterAll(async () => {
  if (prisma) {
    await prisma.issue.deleteMany({
      where: { project: { issueProvider: { userId: TEST_USER_ID } } },
    });
    await prisma.project.deleteMany({
      where: { id: { in: [seededProjectAlphaId, seededProjectBetaId].filter(Boolean) } },
    });
    await prisma.issueProvider.deleteMany({
      where: { id: { in: [seededProviderGithubId, seededProviderJiraId].filter(Boolean) } },
    });
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
    await prisma.$disconnect();
  }
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/issues — keyword search (q param)", () => {
  it("returns only issues whose title contains the keyword", async () => {
    if (!dbAvailable) return;

    const { GET } = await importIssuesRoute(prisma);
    const req = new NextRequest("http://localhost/api/issues?q=login");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    const titles: string[] = json.data.items.map((i: { title: string }) => i.title);
    expect(titles.every((t) => t.toLowerCase().includes("login"))).toBe(true);
    expect(titles.length).toBeGreaterThan(0);
  });

  it("returns issues matching either keyword (multi-keyword OR)", async () => {
    if (!dbAvailable) return;

    const { GET } = await importIssuesRoute(prisma);
    // "docs" matches "Update docs"; "performance" matches "Improve performance"
    const req = new NextRequest("http://localhost/api/issues?q=docs%20performance");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    const titles: string[] = json.data.items.map((i: { title: string }) => i.title);
    expect(titles.some((t) => t.toLowerCase().includes("docs"))).toBe(true);
    expect(titles.some((t) => t.toLowerCase().includes("performance"))).toBe(true);
  });

  it("returns issues matching a double-quoted phrase", async () => {
    if (!dbAvailable) return;

    const { GET } = await importIssuesRoute(prisma);
    const req = new NextRequest(
      `http://localhost/api/issues?q=${encodeURIComponent('"login bug"')}`
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    const titles: string[] = json.data.items.map((i: { title: string }) => i.title);
    expect(titles.some((t) => t.toLowerCase().includes("login bug"))).toBe(true);
  });

  it("returns full list when q is empty", async () => {
    if (!dbAvailable) return;

    const { GET } = await importIssuesRoute(prisma);
    const reqWith = new NextRequest("http://localhost/api/issues?q=");
    const reqWithout = new NextRequest("http://localhost/api/issues");

    const [resWith, resWithout] = await Promise.all([GET(reqWith), GET(reqWithout)]);
    const [jsonWith, jsonWithout] = await Promise.all([resWith.json(), resWithout.json()]);

    expect(jsonWith.data.total).toBe(jsonWithout.data.total);
  });

  it("does not include todayFlag:true issues in search results", async () => {
    if (!dbAvailable) return;

    // Temporarily flag one issue as today
    const todayIssue = await prisma.issue.findFirst({
      where: { project: { issueProvider: { userId: TEST_USER_ID } }, todayFlag: false },
    });
    if (!todayIssue) return;

    await prisma.issue.update({ where: { id: todayIssue.id }, data: { todayFlag: true } });

    try {
      const { GET } = await importIssuesRoute(prisma);
      const req = new NextRequest("http://localhost/api/issues");
      const res = await GET(req);
      const json = await res.json();

      const ids: string[] = json.data.items.map((i: { id: string }) => i.id);
      expect(ids).not.toContain(todayIssue.id);
    } finally {
      await prisma.issue.update({ where: { id: todayIssue.id }, data: { todayFlag: false } });
    }
  });
});

describe("GET /api/issues — filter params", () => {
  it("returns only GITHUB issues when provider=GITHUB", async () => {
    if (!dbAvailable) return;

    const { GET } = await importIssuesRoute(prisma);
    const req = new NextRequest("http://localhost/api/issues?provider=GITHUB");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    const items = json.data.items as Array<{
      project: { issueProvider: { type: string } };
    }>;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.project.issueProvider.type === "GITHUB")).toBe(true);
  });

  it("returns only JIRA issues when provider=JIRA", async () => {
    if (!dbAvailable) return;

    const { GET } = await importIssuesRoute(prisma);
    const req = new NextRequest("http://localhost/api/issues?provider=JIRA");
    const res = await GET(req);
    const json = await res.json();

    const items = json.data.items as Array<{
      project: { issueProvider: { type: string } };
    }>;
    expect(items.every((i) => i.project.issueProvider.type === "JIRA")).toBe(true);
  });

  it("returns only issues from matching project (partial match)", async () => {
    if (!dbAvailable) return;

    const { GET } = await importIssuesRoute(prisma);
    const req = new NextRequest("http://localhost/api/issues?project=alpha");
    const res = await GET(req);
    const json = await res.json();

    const items = json.data.items as Array<{ project: { displayName: string } }>;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.project.displayName.toLowerCase().includes("alpha"))).toBe(true);
  });

  it("returns only unassigned issues when assignee=unassigned", async () => {
    if (!dbAvailable) return;

    const { GET } = await importIssuesRoute(prisma);
    const req = new NextRequest("http://localhost/api/issues?assignee=unassigned");
    const res = await GET(req);
    const json = await res.json();

    const items = json.data.items as Array<{ isUnassigned: boolean }>;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.isUnassigned === true)).toBe(true);
  });

  it("returns only assigned issues when assignee=assigned", async () => {
    if (!dbAvailable) return;

    const { GET } = await importIssuesRoute(prisma);
    const req = new NextRequest("http://localhost/api/issues?assignee=assigned");
    const res = await GET(req);
    const json = await res.json();

    const items = json.data.items as Array<{ isUnassigned: boolean }>;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.isUnassigned === false)).toBe(true);
  });

  it("ANDs q and provider filters together", async () => {
    if (!dbAvailable) return;

    const { GET } = await importIssuesRoute(prisma);
    // "login" appears in both GitHub and Jira; with provider=GITHUB only GitHub ones should appear
    const req = new NextRequest("http://localhost/api/issues?q=login&provider=GITHUB");
    const res = await GET(req);
    const json = await res.json();

    const items = json.data.items as Array<{
      title: string;
      project: { issueProvider: { type: string } };
    }>;
    expect(items.every((i) => i.project.issueProvider.type === "GITHUB")).toBe(true);
    expect(items.every((i) => i.title.toLowerCase().includes("login"))).toBe(true);
  });

  it("pagination still works with filters applied", async () => {
    if (!dbAvailable) return;

    const { GET } = await importIssuesRoute(prisma);
    const req = new NextRequest("http://localhost/api/issues?provider=GITHUB&page=1&limit=2");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.items.length).toBeLessThanOrEqual(2);
    expect(typeof json.data.total).toBe("number");
  });

  it("returns issues with dueDate today when dueDateRange=today", async () => {
    if (!dbAvailable) return;

    const { GET } = await importIssuesRoute(prisma);
    const req = new NextRequest("http://localhost/api/issues?dueDateRange=today");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    const items = json.data.items as Array<{ dueDate: string | null }>;
    const today = new Date();
    items.forEach((item) => {
      if (item.dueDate) {
        const d = new Date(item.dueDate);
        expect(d.toDateString()).toBe(today.toDateString());
      }
    });
  });
});
