/** @jest-environment node */
/**
 * Integration tests for GET and PUT /api/board-settings.
 * Uses a real Prisma client against the test database.
 *
 * Prerequisites:
 *   - DATABASE_URL environment variable pointing to the test DB
 *   - DB migrated: npx prisma migrate deploy
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

const TEST_USER_A = "board-settings-integration-user-a";
const TEST_USER_B = "board-settings-integration-user-b";

jest.mock("@/lib/auth/auth", () => ({ auth: jest.fn() }));

import { auth } from "@/lib/auth/auth";
const mockAuth = auth as jest.Mock;

let prismaClient: PrismaClient;
let dbAvailable = false;

async function importRoute(p: unknown) {
  jest.resetModules();
  jest.doMock("@/lib/db/db", () => ({ prisma: p }));
  jest.doMock("@/lib/auth/auth", () => ({
    auth: mockAuth,
  }));
  return await import("@/app/api/board-settings/route");
}

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost/api/board-settings");
}

function makePutRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/board-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set — skipping board-settings integration tests");
    return;
  }
  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    prismaClient = new PrismaClient({ adapter });
    await prismaClient.$connect();
    dbAvailable = true;

    // Seed test users
    for (const id of [TEST_USER_A, TEST_USER_B]) {
      await prismaClient.user.upsert({
        where: { id },
        update: {},
        create: {
          id,
          email: `${id}@integration.test`,
          passwordHash: "hashed",
          role: "USER",
        },
      });
    }
    // Clean up any stale board settings
    await prismaClient.boardSettings.deleteMany({
      where: { userId: { in: [TEST_USER_A, TEST_USER_B] } },
    });
  } catch (err) {
    console.warn("DB unavailable — skipping board-settings integration tests", err);
  }
});

afterAll(async () => {
  if (dbAvailable) {
    await prismaClient.boardSettings.deleteMany({
      where: { userId: { in: [TEST_USER_A, TEST_USER_B] } },
    });
    await prismaClient.$disconnect();
  }
});

describe("GET /api/board-settings (integration)", () => {
  it("returns default values when no DB record exists (no row created)", async () => {
    if (!dbAvailable) return;

    mockAuth.mockResolvedValue({ user: { id: TEST_USER_A, email: `${TEST_USER_A}@integration.test`, role: "USER" } });
    const { GET } = await importRoute(prismaClient);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual({
      showCreatedAt: true,
      showUpdatedAt: false,
      sortOrder: ["dueDate_asc", "providerUpdatedAt_desc"],
    });

    // Confirm no row was created
    const row = await prismaClient.boardSettings.findUnique({ where: { userId: TEST_USER_A } });
    expect(row).toBeNull();
  });

  it("returns stored values when a record exists", async () => {
    if (!dbAvailable) return;

    await prismaClient.boardSettings.create({
      data: {
        userId: TEST_USER_A,
        showCreatedAt: false,
        showUpdatedAt: true,
        sortOrder: ["providerUpdatedAt_desc"],
      },
    });

    mockAuth.mockResolvedValue({ user: { id: TEST_USER_A, email: `${TEST_USER_A}@integration.test`, role: "USER" } });
    const { GET } = await importRoute(prismaClient);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.showCreatedAt).toBe(false);
    expect(json.data.showUpdatedAt).toBe(true);
    expect(json.data.sortOrder).toEqual(["providerUpdatedAt_desc"]);

    // Clean up
    await prismaClient.boardSettings.delete({ where: { userId: TEST_USER_A } });
  });
});

describe("PUT /api/board-settings (integration)", () => {
  afterEach(async () => {
    if (dbAvailable) {
      await prismaClient.boardSettings.deleteMany({
        where: { userId: { in: [TEST_USER_A, TEST_USER_B] } },
      });
    }
  });

  it("creates a record on first PUT", async () => {
    if (!dbAvailable) return;

    mockAuth.mockResolvedValue({ user: { id: TEST_USER_A, email: `${TEST_USER_A}@integration.test`, role: "USER" } });
    const { PUT } = await importRoute(prismaClient);
    const body = { showCreatedAt: true, showUpdatedAt: true, sortOrder: ["providerUpdatedAt_desc"] };

    const res = await PUT(makePutRequest(body));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.showUpdatedAt).toBe(true);

    const row = await prismaClient.boardSettings.findUnique({ where: { userId: TEST_USER_A } });
    expect(row).not.toBeNull();
    expect(row!.showUpdatedAt).toBe(true);
  });

  it("updates the same record on second PUT (upsert idempotent)", async () => {
    if (!dbAvailable) return;

    mockAuth.mockResolvedValue({ user: { id: TEST_USER_A, email: `${TEST_USER_A}@integration.test`, role: "USER" } });
    const { PUT } = await importRoute(prismaClient);

    await PUT(makePutRequest({ showCreatedAt: true, showUpdatedAt: false, sortOrder: ["dueDate_asc"] }));
    const res = await PUT(makePutRequest({ showCreatedAt: false, showUpdatedAt: true, sortOrder: ["providerUpdatedAt_desc"] }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.showCreatedAt).toBe(false);

    const rows = await prismaClient.boardSettings.findMany({ where: { userId: TEST_USER_A } });
    expect(rows).toHaveLength(1);
  });

  it("userId isolation — user A settings not visible to user B", async () => {
    if (!dbAvailable) return;

    // Save as user A
    mockAuth.mockResolvedValue({ user: { id: TEST_USER_A, email: `${TEST_USER_A}@integration.test`, role: "USER" } });
    const { PUT: PUT_A, GET: GET_A } = await importRoute(prismaClient);
    await PUT_A(makePutRequest({ showCreatedAt: false, showUpdatedAt: true, sortOrder: ["providerUpdatedAt_desc"] }));

    // Read as user B (no record)
    mockAuth.mockResolvedValue({ user: { id: TEST_USER_B, email: `${TEST_USER_B}@integration.test`, role: "USER" } });
    const { GET: GET_B } = await importRoute(prismaClient);
    const res = await GET_B(makeGetRequest());
    const json = await res.json();

    // User B should get defaults, not user A's settings
    expect(json.data.showCreatedAt).toBe(true);
    expect(json.data.showUpdatedAt).toBe(false);
  });
});
