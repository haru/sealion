/** @jest-environment node */
/**
 * Unit tests for GET /api/admin/auth-providers (no DB required).
 */

import { NextRequest } from "next/server";

jest.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => Promise<unknown>>(fn: T) => fn,
  revalidateTag: jest.fn(),
}));

function mockAuth(session: unknown) {
  jest.resetModules();
  jest.doMock("@/lib/auth/auth", () => ({
    auth: jest.fn().mockResolvedValue(session),
  }));
}

function mockServiceProvider(overrides: Record<string, unknown>) {
  jest.doMock("@/services/auth-provider", () => overrides);
}

describe("GET /api/admin/auth-providers — unit (no DB required)", () => {
  test("returns 401 when unauthenticated", async () => {
    mockAuth(null);
    mockServiceProvider({ listAll: jest.fn(), countLinkedAccounts: jest.fn() });
    const { GET } = await import("@/app/api/admin/auth-providers/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  test("returns 403 when role is not ADMIN", async () => {
    mockAuth({ user: { id: "u1", email: "u@t.com", role: "USER" } });
    mockServiceProvider({ listAll: jest.fn(), countLinkedAccounts: jest.fn() });
    const { GET } = await import("@/app/api/admin/auth-providers/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  test("returns providers with linkedAccountCount for admin", async () => {
    mockAuth({ user: { id: "a1", email: "a@t.com", role: "ADMIN" } });
    mockServiceProvider({
      listAll: jest.fn().mockResolvedValue([
        {
          id: "id1",
          providerId: "google",
          type: "GOOGLE",
          displayName: "Google",
          enabled: true,
          issuerUrl: null,
          clientId: "c",
          scope: null,
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
        },
      ]),
      countLinkedAccounts: jest.fn().mockResolvedValue(3),
      AuthProviderCreateSchema: { safeParse: () => ({ success: true, data: {} }) },
    });
    const { GET } = await import("@/app/api/admin/auth-providers/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].linkedAccountCount).toBe(3);
    expect(json.data[0].providerId).toBe("google");
  });
});

describe("POST /api/admin/auth-providers — unit (no DB required)", () => {
  test("returns 401 when unauthenticated", async () => {
    mockAuth(null);
    mockServiceProvider({ AuthProviderCreateSchema: { safeParse: () => ({ success: true, data: {} }) } });
    const { POST } = await import("@/app/api/admin/auth-providers/route");
    const req = new NextRequest("http://localhost/api/admin/auth-providers", {
      method: "POST",
      body: JSON.stringify({ providerId: "google", type: "GOOGLE", displayName: "Google", clientId: "c", clientSecret: "s" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test("returns 403 when role is not ADMIN", async () => {
    mockAuth({ user: { id: "u1", email: "u@t.com", role: "USER" } });
    mockServiceProvider({ AuthProviderCreateSchema: { safeParse: () => ({ success: true, data: {} }) } });
    const { POST } = await import("@/app/api/admin/auth-providers/route");
    const req = new NextRequest("http://localhost/api/admin/auth-providers", {
      method: "POST",
      body: JSON.stringify({ providerId: "google", type: "GOOGLE", displayName: "Google", clientId: "c", clientSecret: "s" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  test("returns 400 INVALID_INPUT when body is not JSON", async () => {
    mockAuth({ user: { id: "a1", email: "a@t.com", role: "ADMIN" } });
    mockServiceProvider({ AuthProviderCreateSchema: { safeParse: () => ({ success: true, data: {} }) } });
    const { POST } = await import("@/app/api/admin/auth-providers/route");
    const req = new NextRequest("http://localhost/api/admin/auth-providers", {
      method: "POST",
      body: "not-json{{{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("returns 400 when Zod validation fails", async () => {
    mockAuth({ user: { id: "a1", email: "a@t.com", role: "ADMIN" } });
    mockServiceProvider({
      AuthProviderCreateSchema: {
        safeParse: () => ({
          success: false,
          error: { issues: [{ message: "bad input" }] },
        }),
      },
      failWithDetails: () => {},
    });
    const { POST } = await import("@/app/api/admin/auth-providers/route");
    const req = new NextRequest("http://localhost/api/admin/auth-providers", {
      method: "POST",
      body: JSON.stringify({ bad: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("returns 201 on successful create", async () => {
    mockAuth({ user: { id: "a1", email: "a@t.com", role: "ADMIN" } });
    mockServiceProvider({
      AuthProviderCreateSchema: { safeParse: (b: unknown) => ({ success: true, data: b }) },
      create: jest.fn().mockResolvedValue({
        id: "id1",
        providerId: "google",
        type: "GOOGLE",
        displayName: "Google",
        enabled: true,
        issuerUrl: null,
        clientId: "c",
        scope: null,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      }),
      countLinkedAccounts: jest.fn(),
      listAll: jest.fn(),
    });
    const { POST } = await import("@/app/api/admin/auth-providers/route");
    const req = new NextRequest("http://localhost/api/admin/auth-providers", {
      method: "POST",
      body: JSON.stringify({ providerId: "google", type: "GOOGLE", displayName: "Google", clientId: "c", clientSecret: "s" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data.providerId).toBe("google");
  });

  test("returns 409 PROVIDER_ID_TAKEN on duplicate", async () => {
    mockAuth({ user: { id: "a1", email: "a@t.com", role: "ADMIN" } });
    const { Prisma } = await import("@prisma/client");
    const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint", {
      code: "P2002",
      clientVersion: "0.0.0",
    });
    mockServiceProvider({
      AuthProviderCreateSchema: { safeParse: (b: unknown) => ({ success: true, data: b }) },
      create: jest.fn().mockRejectedValue(prismaError),
      countLinkedAccounts: jest.fn(),
      listAll: jest.fn(),
    });
    const { POST } = await import("@/app/api/admin/auth-providers/route");
    const req = new NextRequest("http://localhost/api/admin/auth-providers", {
      method: "POST",
      body: JSON.stringify({ providerId: "google", type: "GOOGLE", displayName: "Google", clientId: "c", clientSecret: "s" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  test("returns 500 on unexpected error during create", async () => {
    mockAuth({ user: { id: "a1", email: "a@t.com", role: "ADMIN" } });
    mockServiceProvider({
      AuthProviderCreateSchema: { safeParse: (b: unknown) => ({ success: true, data: b }) },
      create: jest.fn().mockRejectedValue(new Error("unknown")),
      countLinkedAccounts: jest.fn(),
      listAll: jest.fn(),
    });
    const { POST } = await import("@/app/api/admin/auth-providers/route");
    const req = new NextRequest("http://localhost/api/admin/auth-providers", {
      method: "POST",
      body: JSON.stringify({ providerId: "google", type: "GOOGLE", displayName: "Google", clientId: "c", clientSecret: "s" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
