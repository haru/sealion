/** @jest-environment node */
/**
 * Integration tests for POST /api/admin/users.
 *
 * Uses a real Prisma client against the test database.
 *
 * Prerequisites:
 *   - DATABASE_URL environment variable pointing to the test DB
 *   - DB migrated: npx prisma migrate deploy
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth/auth", () => ({ auth: jest.fn() }));

import { auth } from "@/lib/auth/auth";
const mockAuth = auth as jest.Mock;

const ADMIN_SESSION = { user: { id: "int-admin-users-1", email: "admin@users.test", role: "ADMIN" } };
const TEST_EMAIL = "newuser@users-int.test";

let prismaClient: PrismaClient;
let dbAvailable = false;

async function importRoute(p: unknown) {
  jest.resetModules();
  jest.doMock("@/lib/db/db", () => ({ prisma: p }));
  jest.doMock("@/lib/auth/auth", () => ({ auth: mockAuth }));
  return await import("@/app/api/admin/users/route");
}

function makePostRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set — skipping admin users integration tests");
    return;
  }
  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    prismaClient = new PrismaClient({ adapter });
    await prismaClient.$connect();
    dbAvailable = true;
  } catch (err) {
    console.warn("DB unavailable — skipping admin users integration tests", err);
  }
});

afterAll(async () => {
  if (dbAvailable) {
    await prismaClient.user.deleteMany({ where: { email: TEST_EMAIL } });
    await prismaClient.$disconnect();
  }
});

beforeEach(async () => {
  mockAuth.mockResolvedValue(ADMIN_SESSION);
  if (dbAvailable) {
    await prismaClient.user.deleteMany({ where: { email: TEST_EMAIL } });
  }
});

describe("POST /api/admin/users — confirmPassword (integration)", () => {
  it("returns 400 PASSWORD_MISMATCH when confirmPassword is missing", async () => {
    if (!dbAvailable) return;
    const { POST } = await importRoute(prismaClient);

    const res = await POST(makePostRequest({ email: TEST_EMAIL, password: "password123", username: "Test" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("PASSWORD_MISMATCH");
  });

  it("returns 400 PASSWORD_MISMATCH when passwords do not match", async () => {
    if (!dbAvailable) return;
    const { POST } = await importRoute(prismaClient);

    const res = await POST(makePostRequest({ email: TEST_EMAIL, password: "password123", confirmPassword: "wrong", username: "Test" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("PASSWORD_MISMATCH");
  });

  it("creates user when passwords match and all fields are valid", async () => {
    if (!dbAvailable) return;
    const { POST } = await importRoute(prismaClient);

    const res = await POST(makePostRequest({ email: TEST_EMAIL, password: "password123", confirmPassword: "password123", username: "Test User" }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.email).toBe(TEST_EMAIL);
    expect(json.data.username).toBe("Test User");
  });
});
