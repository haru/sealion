/** @jest-environment node */
/**
 * Integration test: PATCH /api/account/settings
 * Tests unified profile settings endpoint (username, Gravatar, optional password change).
 *
 * Prerequisites:
 *   - DATABASE_URL environment variable pointing to test DB
 *   - DB migrated: npx prisma migrate deploy
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

const TEST_USER_ID = "settings-integration-test-user";
const TEST_USER_EMAIL = "settings-test@integration.com";

jest.mock("@/lib/auth/auth", () => ({
  auth: jest.fn().mockResolvedValue({
    user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
  }),
}));

jest.mock("@/lib/db/db", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

async function importRoute() {
  jest.resetModules();
  jest.doMock("@/lib/auth/auth", () => ({
    auth: jest.fn().mockResolvedValue({
      user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
    }),
  }));
  jest.doMock("@/lib/db/db", () => ({ prisma }));
  return await import("@/app/api/account/settings/route");
}

let prisma: PrismaClient;
let dbAvailable = false;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set — skipping DB-dependent tests");
    return;
  }
  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter } as Parameters<typeof PrismaClient>[0]);
    await prisma.$connect();
    dbAvailable = true;
  } catch {
    console.warn("Could not connect to test database — skipping DB-dependent tests");
  }
});

afterAll(async () => {
  if (dbAvailable) {
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
    await prisma.$disconnect();
  }
});

async function seedUser(plaintextPassword = "password123") {
  const passwordHash = await bcrypt.hash(plaintextPassword, 10);
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: { passwordHash },
    create: {
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      passwordHash,
      role: "USER",
    },
  });
}

function makePatchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/account/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Unauthenticated
// ---------------------------------------------------------------------------

describe("PATCH /api/account/settings — unauthenticated (no DB required)", () => {
  test("returns 401 when no session exists", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue(null),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: { user: { findUnique: jest.fn(), update: jest.fn() } },
    }));
    const { PATCH } = await import("@/app/api/account/settings/route");
    const req = makePatchRequest({ username: "alice", useGravatar: false, changePassword: false });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("UNAUTHORIZED");
  });
});

// ---------------------------------------------------------------------------
// Success — no password change
// ---------------------------------------------------------------------------

describe("PATCH /api/account/settings — success without password change (no DB required)", () => {
  test("returns 200 when username and useGravatar are updated (changePassword: false)", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: TEST_USER_ID,
            email: TEST_USER_EMAIL,
            passwordHash: bcrypt.hashSync("password123", 10),
          }),
          update: jest.fn().mockResolvedValue({ id: TEST_USER_ID }),
        },
      },
    }));
    const { PATCH } = await import("@/app/api/account/settings/route");
    const req = makePatchRequest({ username: "alice", useGravatar: true, changePassword: false });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeNull();
    expect(json.error).toBeNull();
  });

  test("returns 200 when username is null (clear username)", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: TEST_USER_ID,
            email: TEST_USER_EMAIL,
            passwordHash: bcrypt.hashSync("password123", 10),
          }),
          update: jest.fn().mockResolvedValue({ id: TEST_USER_ID }),
        },
      },
    }));
    const { PATCH } = await import("@/app/api/account/settings/route");
    const req = makePatchRequest({ username: null, useGravatar: false, changePassword: false });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Success — with password change
// ---------------------------------------------------------------------------

describe("PATCH /api/account/settings — success with password change (no DB required)", () => {
  test("returns 200 when all fields are valid and password matches", async () => {
    const currentPassword = "current123";
    const passwordHash = bcrypt.hashSync(currentPassword, 10);
    jest.resetModules();
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: TEST_USER_ID,
            email: TEST_USER_EMAIL,
            passwordHash,
          }),
          update: jest.fn().mockResolvedValue({ id: TEST_USER_ID }),
        },
      },
    }));
    const { PATCH } = await import("@/app/api/account/settings/route");
    const req = makePatchRequest({
      username: "alice",
      useGravatar: false,
      changePassword: true,
      currentPassword,
      newPassword: "newpassword123",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeNull();
    expect(json.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

describe("PATCH /api/account/settings — validation errors (no DB required)", () => {
  test("returns 400 USERNAME_TOO_LONG when username exceeds 50 characters", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: TEST_USER_ID, passwordHash: "hash" }),
          update: jest.fn(),
        },
      },
    }));
    const { PATCH } = await import("@/app/api/account/settings/route");
    const req = makePatchRequest({
      username: "a".repeat(51),
      useGravatar: false,
      changePassword: false,
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("USERNAME_TOO_LONG");
  });

  test("returns 400 PASSWORD_CURRENT_REQUIRED when changePassword is true but currentPassword is empty", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: {
        user: { findUnique: jest.fn(), update: jest.fn() },
      },
    }));
    const { PATCH } = await import("@/app/api/account/settings/route");
    // Zod discriminated union: currentPassword must be min(1), so empty string fails at schema level
    const req = makePatchRequest({
      username: "alice",
      useGravatar: false,
      changePassword: true,
      currentPassword: "",
      newPassword: "newpassword123",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("PASSWORD_CURRENT_REQUIRED");
  });

  test("returns 400 PASSWORD_TOO_SHORT when newPassword is fewer than 8 characters", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: {
        user: { findUnique: jest.fn(), update: jest.fn() },
      },
    }));
    const { PATCH } = await import("@/app/api/account/settings/route");
    const req = makePatchRequest({
      username: "alice",
      useGravatar: false,
      changePassword: true,
      currentPassword: "currentpass",
      newPassword: "short",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("PASSWORD_TOO_SHORT");
  });

  test("returns 400 PASSWORD_INCORRECT when currentPassword does not match stored hash", async () => {
    const passwordHash = bcrypt.hashSync("correctpass", 10);
    jest.resetModules();
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: TEST_USER_ID, passwordHash }),
          update: jest.fn(),
        },
      },
    }));
    const { PATCH } = await import("@/app/api/account/settings/route");
    const req = makePatchRequest({
      username: "alice",
      useGravatar: false,
      changePassword: true,
      currentPassword: "wrongpass",
      newPassword: "newpassword123",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("PASSWORD_INCORRECT");
  });

  test("returns 400 INVALID_INPUT when body is missing required fields", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: { user: { findUnique: jest.fn(), update: jest.fn() } },
    }));
    const { PATCH } = await import("@/app/api/account/settings/route");
    const req = makePatchRequest({ onlyOneField: "value" });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_INPUT");
  });
});

// ---------------------------------------------------------------------------
// User not found (401)
// ---------------------------------------------------------------------------

describe("PATCH /api/account/settings — user not found (no DB required)", () => {
  test("returns 401 when session is valid but user record does not exist", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
      },
    }));
    const { PATCH } = await import("@/app/api/account/settings/route");
    const req = makePatchRequest({ username: "alice", useGravatar: false, changePassword: false });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("UNAUTHORIZED");
  });
});

// ---------------------------------------------------------------------------
// Internal error (500)
// ---------------------------------------------------------------------------

describe("PATCH /api/account/settings — internal error (no DB required)", () => {
  test("returns 500 when prisma.user.update throws", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: TEST_USER_ID,
            passwordHash: bcrypt.hashSync("pass", 10),
          }),
          update: jest.fn().mockRejectedValue(new Error("DB failure")),
        },
      },
    }));
    const { PATCH } = await import("@/app/api/account/settings/route");
    const req = makePatchRequest({ username: "alice", useGravatar: false, changePassword: false });
    const res = await PATCH(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("INTERNAL_ERROR");
  });
});

// ---------------------------------------------------------------------------
// Real database
// ---------------------------------------------------------------------------

describe("PATCH /api/account/settings — with real database", () => {
  const CURRENT_PASSWORD = "MyCurrentPass1!";
  const dbTest = dbAvailable ? test : test.skip;

  beforeAll(async () => {
    if (!dbAvailable) return;
    await seedUser(CURRENT_PASSWORD);
  });

  dbTest("saves username and useGravatar atomically (changePassword: false)", async () => {
    const { PATCH } = await importRoute();
    const req = makePatchRequest({ username: "dbuser", useGravatar: true, changePassword: false });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();

    const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
    expect(user?.username).toBe("dbuser");
    expect(user?.useGravatar).toBe(true);
  });

  dbTest("saves username, useGravatar, and new password atomically (changePassword: true)", async () => {
    const NEW_PASSWORD = "NewPass99!";
    const { PATCH } = await importRoute();
    const req = makePatchRequest({
      username: "dbuser2",
      useGravatar: false,
      changePassword: true,
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
    expect(user?.username).toBe("dbuser2");
    expect(user?.useGravatar).toBe(false);
    const matches = await bcrypt.compare(NEW_PASSWORD, user!.passwordHash);
    expect(matches).toBe(true);
  });
});
