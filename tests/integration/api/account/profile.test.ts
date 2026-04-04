/** @jest-environment node */
/**
 * Integration test: GET and PATCH /api/account/profile
 * Tests username fetch and update endpoint.
 *
 * Prerequisites:
 *   - DATABASE_URL environment variable pointing to test DB
 *   - DB migrated: npx prisma migrate deploy
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { NextRequest } from "next/server";

const TEST_USER_ID = "profile-integration-test-user";
const TEST_USER_EMAIL = "profile-test@integration.com";

jest.mock("@/lib/auth", () => ({
  auth: jest.fn().mockResolvedValue({
    user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
  }),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

async function importRoute() {
  jest.resetModules();
  jest.doMock("@/lib/auth", () => ({
    auth: jest.fn().mockResolvedValue({
      user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
    }),
  }));
  jest.doMock("@/lib/db", () => ({ prisma }));
  return await import("@/app/api/account/profile/route");
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

async function seedUser(username?: string | null) {
  const { default: bcrypt } = await import("bcryptjs");
  const passwordHash = await bcrypt.hash("password123", 10);
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: { username: username ?? undefined, passwordHash },
    create: {
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      passwordHash,
      role: "USER",
      ...(username != null ? { username } : {}),
    },
  });
}

function makePatchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/account/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/account/profile — unauthenticated (no DB required)", () => {
  test("returns 401 when no session exists", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth", () => ({
      auth: jest.fn().mockResolvedValue(null),
    }));
    jest.doMock("@/lib/db", () => ({
      prisma: {
        user: { findUnique: jest.fn(), update: jest.fn() },
      },
    }));
    const { PATCH } = await import("@/app/api/account/profile/route");
    const req = makePatchRequest({ username: "newname" });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });
});

describe("PATCH /api/account/profile — input validation (no DB required)", () => {
  test("returns 400 when username exceeds 50 characters", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: TEST_USER_ID,
            email: TEST_USER_EMAIL,
          }),
          update: jest.fn(),
        },
      },
    }));
    const { PATCH } = await import("@/app/api/account/profile/route");
    const req = makePatchRequest({ username: "a".repeat(51) });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("USERNAME_TOO_LONG");
  });

  test("normalizes whitespace-only username to null (clears username)", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: TEST_USER_ID,
            email: TEST_USER_EMAIL,
          }),
          update: jest.fn().mockResolvedValue({
            id: TEST_USER_ID,
            email: TEST_USER_EMAIL,
            username: null,
          }),
        },
      },
    }));
    const { PATCH } = await import("@/app/api/account/profile/route");
    const req = makePatchRequest({ username: "   " });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();
  });

  test("returns 400 when request body is invalid JSON shape", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: TEST_USER_ID,
            email: TEST_USER_EMAIL,
          }),
          update: jest.fn(),
        },
      },
    }));
    const { PATCH } = await import("@/app/api/account/profile/route");
    const req = makePatchRequest({ unexpectedField: "value" });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_INPUT");
  });

  test("returns 200 when username is set to null (clear)", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: TEST_USER_ID,
            email: TEST_USER_EMAIL,
          }),
          update: jest.fn().mockResolvedValue({
            id: TEST_USER_ID,
            email: TEST_USER_EMAIL,
            username: null,
          }),
        },
      },
    }));
    const { PATCH } = await import("@/app/api/account/profile/route");
    const req = makePatchRequest({ username: null });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();
  });
});

describe("PATCH /api/account/profile — user not found (no DB required)", () => {
  test("returns 401 when authenticated but user record does not exist (null username)", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      },
    }));
    const { PATCH } = await import("@/app/api/account/profile/route");
    const req = makePatchRequest({ username: null });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  test("returns 401 when authenticated but user record does not exist (string username)", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      },
    }));
    const { PATCH } = await import("@/app/api/account/profile/route");
    const req = makePatchRequest({ username: "newname" });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });
});

describe("GET /api/account/profile — unauthenticated (no DB required)", () => {
  test("returns 401 when no session exists", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth", () => ({
      auth: jest.fn().mockResolvedValue(null),
    }));
    jest.doMock("@/lib/db", () => ({
      prisma: { user: { findUnique: jest.fn() } },
    }));
    const { GET } = await import("@/app/api/account/profile/route");
    const req = new Request("http://localhost/api/account/profile");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });
});

describe("GET /api/account/profile — with mocked DB (no DB required)", () => {
  test("returns username and email when user has a username set", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: TEST_USER_ID,
            email: TEST_USER_EMAIL,
            username: "testuser",
            role: "USER",
          }),
          count: jest.fn().mockResolvedValue(0),
        },
      },
    }));
    const { GET } = await import("@/app/api/account/profile/route");
    const req = new Request("http://localhost/api/account/profile");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toMatchObject({ username: "testuser", email: TEST_USER_EMAIL, isLastAdmin: false });
    expect(json.error).toBeNull();
  });

  test("returns null username when user has no username set", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: TEST_USER_ID,
            email: TEST_USER_EMAIL,
            username: null,
            role: "USER",
          }),
          count: jest.fn().mockResolvedValue(0),
        },
      },
    }));
    const { GET } = await import("@/app/api/account/profile/route");
    const req = new Request("http://localhost/api/account/profile");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toMatchObject({ username: null, isLastAdmin: false });
    expect(json.error).toBeNull();
  });

  test("returns 401 when user record not found in DB", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValue(0),
        },
      },
    }));
    const { GET } = await import("@/app/api/account/profile/route");
    const req = new Request("http://localhost/api/account/profile");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  test("returns isLastAdmin: true when sole ADMIN requests profile", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "ADMIN" },
      }),
    }));
    jest.doMock("@/lib/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: TEST_USER_ID,
            email: TEST_USER_EMAIL,
            username: null,
            role: "ADMIN",
          }),
          count: jest.fn().mockResolvedValue(1),
        },
      },
    }));
    const { GET } = await import("@/app/api/account/profile/route");
    const req = new Request("http://localhost/api/account/profile");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.isLastAdmin).toBe(true);
    expect(json.data.email).toBe(TEST_USER_EMAIL);
  });

  test("returns isLastAdmin: false when multiple ADMINs exist", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "ADMIN" },
      }),
    }));
    jest.doMock("@/lib/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: TEST_USER_ID,
            email: TEST_USER_EMAIL,
            username: null,
            role: "ADMIN",
          }),
          count: jest.fn().mockResolvedValue(2),
        },
      },
    }));
    const { GET } = await import("@/app/api/account/profile/route");
    const req = new Request("http://localhost/api/account/profile");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.isLastAdmin).toBe(false);
  });

  test("returns isLastAdmin: false for regular USER regardless of admin count", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    jest.doMock("@/lib/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: TEST_USER_ID,
            email: TEST_USER_EMAIL,
            username: "testuser",
            role: "USER",
          }),
          count: jest.fn().mockResolvedValue(1),
        },
      },
    }));
    const { GET } = await import("@/app/api/account/profile/route");
    const req = new Request("http://localhost/api/account/profile");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.isLastAdmin).toBe(false);
    expect(json.data.email).toBe(TEST_USER_EMAIL);
  });
});

describe("PATCH /api/account/profile — with real database", () => {
  beforeAll(async () => {
    if (!dbAvailable) return;
    await seedUser("oldname");
  });

  const dbTest = dbAvailable ? test : test.skip;

  dbTest("returns 200 and updates username on valid request", async () => {
    const { PATCH } = await importRoute();
    const req = makePatchRequest({ username: "newusername" });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.error).toBeNull();

    const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
    expect(user?.username).toBe("newusername");
  });

  dbTest("trims whitespace from username", async () => {
    const { PATCH } = await importRoute();
    const req = makePatchRequest({ username: "  trimmed  " });
    const res = await PATCH(req);
    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
    expect(user?.username).toBe("trimmed");
  });

  dbTest("allows clearing username by setting it to null", async () => {
    const { PATCH } = await importRoute();
    const req = makePatchRequest({ username: null });
    const res = await PATCH(req);
    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
    expect(user?.username).toBeNull();
  });
});
