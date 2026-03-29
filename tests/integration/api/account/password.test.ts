/** @jest-environment node */
/**
 * Integration test: PATCH /api/account/password
 * Uses a real Prisma client against the test database.
 *
 * Prerequisites:
 *   - DATABASE_URL environment variable pointing to test DB
 *   - DB migrated: npx prisma migrate deploy
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

const TEST_USER_ID = "password-integration-test-user";
const TEST_USER_EMAIL = "password-test@integration.com";

// Mock auth — the route reads userId from the session, never from the request body.
jest.mock("@/lib/auth", () => ({
  auth: jest.fn().mockResolvedValue({
    user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
  }),
}));

async function importRoute() {
  jest.resetModules();
  // Re-apply mocks after resetModules
  jest.doMock("@/lib/auth", () => ({
    auth: jest.fn().mockResolvedValue({
      user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
    }),
  }));
  jest.doMock("@/lib/db", () => ({ prisma }));
  return await import("@/app/api/account/password/route");
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

/** Seeds a test user with the given plaintext password. */
async function seedUser(plaintextPassword: string) {
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

/** Creates a PATCH request with the given body. */
function makePatchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/account/password", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/account/password — unauthenticated (no DB required)", () => {
  test("returns 401 when no session exists", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth", () => ({
      auth: jest.fn().mockResolvedValue(null),
    }));
    const { PATCH } = await import("@/app/api/account/password/route");
    const req = makePatchRequest({ currentPassword: "oldpass", newPassword: "newpass123" });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });
});

describe("PATCH /api/account/password — input validation (no DB required)", () => {
  beforeAll(() => {
    jest.resetModules();
    jest.doMock("@/lib/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
  });

  test("returns 400 when newPassword is shorter than 8 characters", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    // Use a mock prisma that returns a user so we reach the length check
    const mockHash = bcrypt.hashSync("currentpass", 10);
    jest.doMock("@/lib/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: TEST_USER_ID,
            passwordHash: mockHash,
          }),
          update: jest.fn(),
        },
      },
    }));
    const { PATCH } = await import("@/app/api/account/password/route");
    const req = makePatchRequest({ currentPassword: "currentpass", newPassword: "short" });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/8/);
  });

  test("returns 400 when currentPassword is empty", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: { id: TEST_USER_ID, email: TEST_USER_EMAIL, role: "USER" },
      }),
    }));
    const mockHash = bcrypt.hashSync("currentpass", 10);
    jest.doMock("@/lib/db", () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: TEST_USER_ID,
            passwordHash: mockHash,
          }),
          update: jest.fn(),
        },
      },
    }));
    const { PATCH } = await import("@/app/api/account/password/route");
    const req = makePatchRequest({ currentPassword: "", newPassword: "newpassword123" });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/account/password — with real database", () => {
  const CURRENT_PASSWORD = "MyCurrentPass1!";
  const NEW_PASSWORD = "MyNewPass99!";

  beforeAll(async () => {
    if (!dbAvailable) return;
    await seedUser(CURRENT_PASSWORD);
  });

  test("returns 200 on valid password change", async () => {
    if (!dbAvailable) return;
    const { PATCH } = await importRoute();
    const req = makePatchRequest({ currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toBeNull();
    expect(json.error).toBeNull();

    // Verify the DB was actually updated
    const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
    const matches = await bcrypt.compare(NEW_PASSWORD, user!.passwordHash);
    expect(matches).toBe(true);
  });

  test("returns 400 when currentPassword is wrong", async () => {
    if (!dbAvailable) return;
    // At this point password is NEW_PASSWORD from the previous test
    const { PATCH } = await importRoute();
    const req = makePatchRequest({ currentPassword: "WrongPassword!", newPassword: "AnotherNew1!" });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });
});
