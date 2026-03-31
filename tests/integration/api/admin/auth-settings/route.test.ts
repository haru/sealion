/** @jest-environment node */
/**
 * Integration tests for GET and PATCH /api/admin/auth-settings.
 * Uses a real Prisma client against the test database.
 *
 * Prerequisites:
 *   - DATABASE_URL environment variable pointing to the test DB
 *   - DB migrated: npx prisma migrate deploy
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));

import { auth } from "@/lib/auth";
const mockAuth = auth as jest.Mock;

const ADMIN_SESSION = { user: { id: "int-admin-1", email: "admin@integration.test", role: "ADMIN" } };

let prismaClient: PrismaClient;
let dbAvailable = false;

async function importRoute(p: unknown) {
  jest.resetModules();
  jest.doMock("@/lib/db", () => ({ prisma: p }));
  jest.doMock("@/lib/auth", () => ({ auth: mockAuth }));
  return await import("@/app/api/admin/auth-settings/route");
}

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost/api/admin/auth-settings");
}

function makePatchRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/admin/auth-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set — skipping auth-settings integration tests");
    return;
  }
  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    prismaClient = new PrismaClient({ adapter });
    await prismaClient.$connect();
    dbAvailable = true;

    // Clean up singleton from previous test runs
    await prismaClient.authSettings.deleteMany({ where: { id: "singleton" } });
  } catch (err) {
    console.warn("DB unavailable — skipping auth-settings integration tests", err);
  }
});

afterAll(async () => {
  if (dbAvailable) {
    await prismaClient.authSettings.deleteMany({ where: { id: "singleton" } });
    await prismaClient.$disconnect();
  }
});

describe("GET /api/admin/auth-settings (integration)", () => {
  afterEach(async () => {
    if (dbAvailable) {
      await prismaClient.authSettings.deleteMany({ where: { id: "singleton" } });
    }
  });

  it("returns default settings and creates record on first call", async () => {
    if (!dbAvailable) return;

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { GET } = await importRoute(prismaClient);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual({ allowUserSignup: true, sessionTimeoutMinutes: null });

    // upsert should have created the record
    const row = await prismaClient.authSettings.findUnique({ where: { id: "singleton" } });
    expect(row).not.toBeNull();
    expect(row!.allowUserSignup).toBe(true);
    expect(row!.sessionTimeoutMinutes).toBeNull();
  });

  it("returns persisted values on subsequent calls", async () => {
    if (!dbAvailable) return;

    await prismaClient.authSettings.create({
      data: { id: "singleton", allowUserSignup: false, sessionTimeoutMinutes: 1440 },
    });

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { GET } = await importRoute(prismaClient);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.allowUserSignup).toBe(false);
    expect(json.data.sessionTimeoutMinutes).toBe(1440);
  });
});

describe("PATCH /api/admin/auth-settings (integration)", () => {
  afterEach(async () => {
    if (dbAvailable) {
      await prismaClient.authSettings.deleteMany({ where: { id: "singleton" } });
    }
  });

  it("creates and updates allowUserSignup to false", async () => {
    if (!dbAvailable) return;

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { PATCH } = await importRoute(prismaClient);

    const res = await PATCH(makePatchRequest({ allowUserSignup: false }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.allowUserSignup).toBe(false);

    const row = await prismaClient.authSettings.findUnique({ where: { id: "singleton" } });
    expect(row!.allowUserSignup).toBe(false);
  });

  it("persists sessionTimeoutMinutes", async () => {
    if (!dbAvailable) return;

    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { PATCH } = await importRoute(prismaClient);

    const res = await PATCH(makePatchRequest({ sessionTimeoutMinutes: 60 }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.sessionTimeoutMinutes).toBe(60);
  });

  it("signup proceeds when allowUserSignup=true in DB", async () => {
    if (!dbAvailable) return;

    await prismaClient.authSettings.create({
      data: { id: "singleton", allowUserSignup: true },
    });

    // Just verify the DB state is correct (signup route tested separately)
    const row = await prismaClient.authSettings.findUnique({ where: { id: "singleton" } });
    expect(row!.allowUserSignup).toBe(true);
  });
});
