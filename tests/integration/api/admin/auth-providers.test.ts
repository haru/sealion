/** @jest-environment node */
/**
 * Integration tests for the admin auth-providers API.
 * Verifies admin role enforcement, Zod validation, providerId uniqueness,
 * and that the response never leaks the client secret.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

// Use the runner's env key so rows persist across test files cleanly.
import { encrypt } from "@/lib/encryption/encryption";

const mockAuth = jest.fn();
jest.mock("@/lib/auth/auth", () => ({
  auth: () => mockAuth(),
}));

jest.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => Promise<unknown>>(fn: T) => fn,
  revalidateTag: jest.fn(),
}));

let prisma: PrismaClient;
let dbAvailable = false;

async function resetTable() {
  await prisma.authProvider.deleteMany({
    where: {
      OR: [
        { providerId: { startsWith: "google-admin-test" } },
        { providerId: "google" },
      ],
    },
  });
}

beforeAll(async () => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  prisma = new PrismaClient({ adapter });
  try {
    await prisma.$connect();
    await prisma.authProvider.count();
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (dbAvailable) { await prisma.$disconnect(); }
});

beforeEach(async () => {
  jest.clearAllMocks();
  if (dbAvailable) { await resetTable(); }
});

function adminSession() {
  return {
    user: { id: "admin-test", email: "admin@example.com", role: "ADMIN" },
  };
}

function userSession() {
  return {
    user: { id: "user-test", email: "user@example.com", role: "USER" },
  };
}

describe("POST /api/admin/auth-providers", () => {
  it("returns 401 when unauthenticated", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue(null);
    const { POST } = await import("@/app/api/admin/auth-providers/route");
    const req = new NextRequest("http://localhost/api/admin/auth-providers", {
      method: "POST",
      body: JSON.stringify({
        providerId: "google-admin-test",
        type: "GOOGLE",
        displayName: "Google",
        clientId: "x",
        clientSecret: "y",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when role !== ADMIN", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue(userSession());
    const { POST } = await import("@/app/api/admin/auth-providers/route");
    const req = new NextRequest("http://localhost/api/admin/auth-providers", {
      method: "POST",
      body: JSON.stringify({
        providerId: "google-admin-test",
        type: "GOOGLE",
        displayName: "Google",
        clientId: "x",
        clientSecret: "y",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 INVALID_INPUT on Zod failure", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue(adminSession());
    const { POST } = await import("@/app/api/admin/auth-providers/route");
    const req = new NextRequest("http://localhost/api/admin/auth-providers", {
      method: "POST",
      body: JSON.stringify({
        providerId: "X bad casing",
        type: "GOOGLE",
        displayName: "",
        clientId: "x",
        clientSecret: "y",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("INVALID_INPUT");
  });

  it("creates a provider and never echoes clientSecret", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue(adminSession());
    const { POST } = await import("@/app/api/admin/auth-providers/route");
    const req = new NextRequest("http://localhost/api/admin/auth-providers", {
      method: "POST",
      body: JSON.stringify({
        providerId: "google-admin-test",
        type: "GOOGLE",
        displayName: "Google",
        clientId: "client-id-value",
        clientSecret: "super-secret-value",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.error).toBeNull();
    expect(body.data.providerId).toBe("google-admin-test");
    expect(JSON.stringify(body)).not.toContain("super-secret-value");
    expect(JSON.stringify(body)).not.toContain("encrypted");
  });

  it("returns 409 PROVIDER_ID_TAKEN on duplicate providerId", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue(adminSession());
    const { POST } = await import("@/app/api/admin/auth-providers/route");

    const body = JSON.stringify({
      providerId: "google",
      type: "GOOGLE",
      displayName: "Google",
      clientId: "x",
      clientSecret: "y",
    });

    await POST(
      new NextRequest("http://localhost/api/admin/auth-providers", {
        method: "POST",
        body,
      }),
    );
    const res = await POST(
      new NextRequest("http://localhost/api/admin/auth-providers", {
        method: "POST",
        body,
      }),
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("PROVIDER_ID_TAKEN");
  });
});

describe("GET /api/admin/auth-providers", () => {
  it("returns 403 when not admin", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue(userSession());
    const { GET } = await import("@/app/api/admin/auth-providers/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns the rows with linkedAccountCount and no secret", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue(adminSession());
    await prisma.authProvider.create({
      data: {
        providerId: "google-admin-test",
        type: "GOOGLE",
        displayName: "Google",
        clientId: "x",
        encryptedClientSecret: encrypt("admin-list-secret"),
        enabled: true,
      },
    });
    const { GET } = await import("@/app/api/admin/auth-providers/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeNull();
    expect(Array.isArray(body.data)).toBe(true);
    const ours = body.data.find(
      (r: { providerId: string }) => r.providerId === "google-admin-test",
    );
    expect(ours).toBeDefined();
    expect(ours.linkedAccountCount).toBe(0);
    expect(JSON.stringify(ours)).not.toContain("admin-list-secret");
  });
});
