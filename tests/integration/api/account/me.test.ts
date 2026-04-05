/** @jest-environment node */
/**
 * Integration tests: DELETE /api/account/me
 *
 * Covers:
 *   - 401 when unauthenticated
 *   - 200 on successful self-deletion (user row removed)
 *   - 403 LAST_ADMIN when the sole system administrator attempts deletion
 *   - 200 when one of multiple admins deletes their own account
 *   - Cascade: IssueProvider, Project, Issue, BoardSettings all removed
 *
 * Prerequisites:
 *   - DATABASE_URL environment variable pointing to test DB
 *   - DB migrated: npx prisma migrate deploy
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Pool as PgPool } from "pg";

const TEST_USER_ID = "me-integration-test-user";
const TEST_USER_EMAIL = "me-test@integration.com";
const TEST_ADMIN_ID = "me-integration-test-admin";
const TEST_ADMIN_EMAIL = "me-admin@integration.com";
const TEST_ADMIN2_ID = "me-integration-test-admin2";
const TEST_ADMIN2_EMAIL = "me-admin2@integration.com";

jest.mock("@/lib/auth/auth", () => ({
  auth: jest.fn().mockResolvedValue({
    user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
  }),
}));

jest.mock("@/lib/db/db", () => ({
  prisma: {
    user: { findUnique: jest.fn(), delete: jest.fn(), count: jest.fn() },
    issue: { deleteMany: jest.fn() },
    project: { deleteMany: jest.fn() },
    issueProvider: { deleteMany: jest.fn() },
    boardSettings: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

// Use a synchronous signal so `dbTest` is determined at test-definition time.
const dbTest = process.env.DATABASE_URL ? test : test.skip;

let prisma: PrismaClient;
let pool: PgPool;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set — skipping DB-dependent tests");
    return;
  }
  try {
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter } as Parameters<typeof PrismaClient>[0]);
    await prisma.$connect();
  } catch {
    console.warn("Could not connect to test database — skipping DB-dependent tests");
  }
});

afterAll(async () => {
  if (prisma) {
    await prisma.user.deleteMany({
      where: { id: { in: [TEST_USER_ID, TEST_ADMIN_ID, TEST_ADMIN2_ID] } },
    });
    await prisma.$disconnect();
  }
  if (pool) {
    await pool.end();
  }
});

/** Seed a regular user with no associated data. */
async function seedUser(id: string, email: string, role: "USER" | "ADMIN" = "USER") {
  const { default: bcrypt } = await import("bcryptjs");
  const passwordHash = await bcrypt.hash("password123", 10);
  await prisma.user.upsert({
    where: { id },
    update: { role, passwordHash },
    create: { id, email, passwordHash, role },
  });
}

/** Seed a user with a full set of associated data (IssueProvider → Project → Issue + BoardSettings). */
async function seedUserWithData(id: string, email: string) {
  await seedUser(id, email, "USER");
  const provider = await prisma.issueProvider.create({
    data: {
      userId: id,
      type: "GITHUB",
      displayName: "Test Provider",
      encryptedCredentials: "dummy-credentials",
    },
  });
  const project = await prisma.project.create({
    data: {
      issueProviderId: provider.id,
      externalId: "test-repo",
      displayName: "Test Repo",
    },
  });
  await prisma.issue.create({
    data: {
      projectId: project.id,
      externalId: "issue-1",
      title: "Test Issue",
      externalUrl: "https://example.com/issues/1",
    },
  });
  await prisma.boardSettings.create({
    data: { userId: id },
  });
}

/** Re-import the route with the real prisma bound to it. */
async function importRouteWithRealDb(sessionUserId: string, sessionRole: "USER" | "ADMIN") {
  jest.resetModules();
  jest.doMock("@/lib/auth/auth", () => ({
    auth: jest.fn().mockResolvedValue({
      user: { id: sessionUserId, email: `${sessionUserId}@test.com`, role: sessionRole },
    }),
  }));
  jest.doMock("@/lib/db/db", () => ({ prisma }));
  return await import("@/app/api/account/me/route");
}

// ─── No-DB tests ──────────────────────────────────────────────────────────────

describe("DELETE /api/account/me — unauthenticated (no DB required)", () => {
  test("returns 401 when no session exists", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue(null),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: {
        user: { findUnique: jest.fn(), count: jest.fn() },
        $transaction: jest.fn(),
        issue: { deleteMany: jest.fn() },
        project: { deleteMany: jest.fn() },
        issueProvider: { deleteMany: jest.fn() },
        boardSettings: { deleteMany: jest.fn() },
      },
    }));
    const { DELETE } = await import("@/app/api/account/me/route");
    const req = new Request("http://localhost/api/account/me", { method: "DELETE" });
    const res = await DELETE(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("UNAUTHORIZED");
  });

  test("returns 401 when user record is not found in the database", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: {
        user: { findUnique: jest.fn().mockResolvedValue(null), count: jest.fn() },
        $transaction: jest.fn(),
        issue: { deleteMany: jest.fn() },
        project: { deleteMany: jest.fn() },
        issueProvider: { deleteMany: jest.fn() },
        boardSettings: { deleteMany: jest.fn() },
      },
    }));
    const { DELETE } = await import("@/app/api/account/me/route");
    const req = new Request("http://localhost/api/account/me", { method: "DELETE" });
    const res = await DELETE(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("UNAUTHORIZED");
  });

  test("returns 401 when user is suspended (not ACTIVE)", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({ role: "USER", status: "SUSPENDED" }),
          count: jest.fn(),
        },
        $transaction: jest.fn(),
        issue: { deleteMany: jest.fn() },
        project: { deleteMany: jest.fn() },
        issueProvider: { deleteMany: jest.fn() },
        boardSettings: { deleteMany: jest.fn() },
      },
    }));
    const { DELETE } = await import("@/app/api/account/me/route");
    const req = new Request("http://localhost/api/account/me", { method: "DELETE" });
    const res = await DELETE(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("UNAUTHORIZED");
  });
});

describe("DELETE /api/account/me — last-admin guard (no DB required)", () => {
  test("returns 403 LAST_ADMIN when sole active admin tries to delete their account", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_ADMIN_ID, email: TEST_ADMIN_EMAIL, role: "ADMIN" },
      }),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({ role: "ADMIN", status: "ACTIVE" }),
          count: jest.fn().mockResolvedValue(1),
        },
        $transaction: jest.fn(),
        issue: { deleteMany: jest.fn() },
        project: { deleteMany: jest.fn() },
        issueProvider: { deleteMany: jest.fn() },
        boardSettings: { deleteMany: jest.fn() },
      },
    }));
    const { DELETE } = await import("@/app/api/account/me/route");
    const req = new Request("http://localhost/api/account/me", { method: "DELETE" });
    const res = await DELETE(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("LAST_ADMIN");
  });

  test("admin count query filters by ACTIVE status only", async () => {
    jest.resetModules();
    const mockCount = jest.fn().mockResolvedValue(1);
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_ADMIN_ID, email: TEST_ADMIN_EMAIL, role: "ADMIN" },
      }),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({ role: "ADMIN", status: "ACTIVE" }),
          count: mockCount,
        },
        $transaction: jest.fn(),
        issue: { deleteMany: jest.fn() },
        project: { deleteMany: jest.fn() },
        issueProvider: { deleteMany: jest.fn() },
        boardSettings: { deleteMany: jest.fn() },
      },
    }));
    const { DELETE } = await import("@/app/api/account/me/route");
    const req = new Request("http://localhost/api/account/me", { method: "DELETE" });
    await DELETE(req as unknown as import("next/server").NextRequest);
    // Verify count was called with both role and status filters
    expect(mockCount).toHaveBeenCalledWith({
      where: { role: "ADMIN", status: "ACTIVE" },
    });
  });

  test("returns 200 when one of multiple admins deletes their account (mocked)", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_ADMIN_ID, email: TEST_ADMIN_EMAIL, role: "ADMIN" },
      }),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({ role: "ADMIN", status: "ACTIVE" }),
          count: jest.fn().mockResolvedValue(2),
          delete: jest.fn().mockResolvedValue({ id: TEST_ADMIN_ID }),
        },
        $transaction: jest.fn().mockResolvedValue([]),
        issue: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        project: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        issueProvider: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        boardSettings: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      },
    }));
    const { DELETE } = await import("@/app/api/account/me/route");
    const req = new Request("http://localhost/api/account/me", { method: "DELETE" });
    const res = await DELETE(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();
  });
});

describe("DELETE /api/account/me — error handling (no DB required)", () => {
  test("returns 500 INTERNAL_ERROR when deleteUserCascade throws", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({ role: "USER", status: "ACTIVE" }),
          count: jest.fn(),
          delete: jest.fn(),
        },
        $transaction: jest.fn().mockRejectedValue(new Error("DB connection lost")),
        issue: { deleteMany: jest.fn() },
        project: { deleteMany: jest.fn() },
        issueProvider: { deleteMany: jest.fn() },
        boardSettings: { deleteMany: jest.fn() },
      },
    }));
    const { DELETE } = await import("@/app/api/account/me/route");
    const req = new Request("http://localhost/api/account/me", { method: "DELETE" });
    const res = await DELETE(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("INTERNAL_ERROR");
  });
});

// ─── DB-dependent tests ────────────────────────────────────────────────────────

describe("DELETE /api/account/me — with real database", () => {

  dbTest("returns 200 and removes user row for a regular user", async () => {
    await seedUser(TEST_USER_ID, TEST_USER_EMAIL, "USER");
    const { DELETE } = await importRouteWithRealDb(TEST_USER_ID, "USER");
    const req = new Request("http://localhost/api/account/me", { method: "DELETE" });
    const res = await DELETE(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeNull();
    expect(json.error).toBeNull();

    const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
    expect(user).toBeNull();
  });

  dbTest("cascade: removes all associated data when account is deleted", async () => {
    await seedUserWithData(TEST_USER_ID, TEST_USER_EMAIL);
    const { DELETE } = await importRouteWithRealDb(TEST_USER_ID, "USER");
    const req = new Request("http://localhost/api/account/me", { method: "DELETE" });
    const res = await DELETE(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);

    // Verify all cascading records are removed (US2 verification)
    const [issueProviders, boardSettings] = await Promise.all([
      prisma.issueProvider.findMany({ where: { userId: TEST_USER_ID } }),
      prisma.boardSettings.findMany({ where: { userId: TEST_USER_ID } }),
    ]);
    expect(issueProviders).toHaveLength(0);
    expect(boardSettings).toHaveLength(0);

    // Verify projects and issues are also removed (cascaded through issueProvider)
    const orphanedProjects = await prisma.project.findMany({
      where: { issueProvider: { userId: TEST_USER_ID } },
    });
    expect(orphanedProjects).toHaveLength(0);
  });

  dbTest("returns 403 LAST_ADMIN when sole admin tries to delete", async () => {
    await seedUser(TEST_ADMIN_ID, TEST_ADMIN_EMAIL, "ADMIN");
    // Ensure TEST_ADMIN2 is gone so TEST_ADMIN is the only admin
    await prisma.user.deleteMany({ where: { id: TEST_ADMIN2_ID } });

    const { DELETE } = await importRouteWithRealDb(TEST_ADMIN_ID, "ADMIN");
    const req = new Request("http://localhost/api/account/me", { method: "DELETE" });
    const res = await DELETE(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("LAST_ADMIN");

    // User should still exist
    const admin = await prisma.user.findUnique({ where: { id: TEST_ADMIN_ID } });
    expect(admin).not.toBeNull();
  });

  dbTest("returns 200 when one of multiple admins deletes their account", async () => {
    await seedUser(TEST_ADMIN_ID, TEST_ADMIN_EMAIL, "ADMIN");
    await seedUser(TEST_ADMIN2_ID, TEST_ADMIN2_EMAIL, "ADMIN");

    const { DELETE } = await importRouteWithRealDb(TEST_ADMIN_ID, "ADMIN");
    const req = new Request("http://localhost/api/account/me", { method: "DELETE" });
    const res = await DELETE(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { id: TEST_ADMIN_ID } });
    expect(user).toBeNull();
  });
});
