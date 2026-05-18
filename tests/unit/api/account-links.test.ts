/** @jest-environment node */
/**
 * Unit tests for GET /api/account/links (no DB required).
 * Uses jest.resetModules + jest.doMock to avoid real DB access.
 */

import { NextRequest } from "next/server";

const TEST_USER_ID = "links-unit-test-user";
const TEST_EMAIL = "links-unit@test.com";

function mockAuth(session: unknown) {
  jest.resetModules();
  jest.doMock("@/lib/auth/auth", () => ({
    auth: jest.fn().mockResolvedValue(session),
  }));
}

function mockDb(overrides: Record<string, unknown>) {
  jest.doMock("@/lib/db/db", () => ({
    prisma: overrides,
  }));
}

describe("GET /api/account/links — unit (no DB required)", () => {
  test("returns 401 when unauthenticated", async () => {
    mockAuth(null);
    mockDb({ account: { findMany: jest.fn() }, authProvider: { findMany: jest.fn() } });
    const { GET } = await import("@/app/api/account/links/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  test("returns linked accounts with provider metadata", async () => {
    mockAuth({ user: { id: TEST_USER_ID, email: TEST_EMAIL, role: "USER" } });
    mockDb({
      account: {
        findMany: jest.fn().mockResolvedValue([
          { id: "a1", provider: "google", type: "oauth" },
        ]),
      },
      authProvider: {
        findMany: jest.fn().mockResolvedValue([
          { providerId: "google", type: "GOOGLE", displayName: "Google" },
        ]),
      },
    });
    const { GET } = await import("@/app/api/account/links/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].provider).toBe("google");
    expect(json.data[0].displayName).toBe("Google");
    expect(json.data[0].type).toBe("GOOGLE");
  });

  test("defaults type to OIDC_GENERIC when no metadata found", async () => {
    mockAuth({ user: { id: TEST_USER_ID, email: TEST_EMAIL, role: "USER" } });
    mockDb({
      account: {
        findMany: jest.fn().mockResolvedValue([
          { id: "a1", provider: "custom-idp", type: "oidc" },
        ]),
      },
      authProvider: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    const { GET } = await import("@/app/api/account/links/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data[0].type).toBe("OIDC_GENERIC");
    expect(json.data[0].displayName).toBe("custom-idp");
  });

  test("returns 500 on unexpected error", async () => {
    mockAuth({ user: { id: TEST_USER_ID, email: TEST_EMAIL, role: "USER" } });
    mockDb({
      account: { findMany: jest.fn().mockRejectedValue(new Error("DB down")) },
      authProvider: { findMany: jest.fn() },
    });
    const { GET } = await import("@/app/api/account/links/route");
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/account/links/[provider] — unit (no DB required)", () => {
  test("returns 401 when unauthenticated", async () => {
    mockAuth(null);
    mockDb({ account: { deleteMany: jest.fn() } });
    const { DELETE } = await import("@/app/api/account/links/[provider]/route");
    const req = new NextRequest("http://localhost/api/account/links/google", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ provider: "google" }) });
    expect(res.status).toBe(401);
  });

  test("returns 400 LAST_AUTH_METHOD when canUnlinkAccount returns false", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue({ user: { id: TEST_USER_ID, email: TEST_EMAIL, role: "USER" } }),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: {
        account: {
          findFirst: jest.fn().mockResolvedValue({ id: "a1" }),
          deleteMany: jest.fn(),
        },
      },
    }));
    jest.doMock("@/services/auth-provider/account-linking", () => ({
      canUnlinkAccount: jest.fn().mockResolvedValue(false),
    }));
    const { DELETE } = await import("@/app/api/account/links/[provider]/route");
    const req = new NextRequest("http://localhost/api/account/links/google", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ provider: "google" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("LAST_AUTH_METHOD");
  });

  test("returns 404 when no matching account exists", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue({ user: { id: TEST_USER_ID, email: TEST_EMAIL, role: "USER" } }),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: { account: { findFirst: jest.fn().mockResolvedValue(null) } },
    }));
    jest.doMock("@/services/auth-provider/account-linking", () => ({
      canUnlinkAccount: jest.fn(),
    }));
    const { DELETE } = await import("@/app/api/account/links/[provider]/route");
    const req = new NextRequest("http://localhost/api/account/links/google", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ provider: "google" }) });
    expect(res.status).toBe(404);
  });

  test("returns 500 when canUnlinkAccount throws", async () => {
    jest.resetModules();
    jest.doMock("@/lib/auth/auth", () => ({
      auth: jest.fn().mockResolvedValue({ user: { id: TEST_USER_ID, email: TEST_EMAIL, role: "USER" } }),
    }));
    jest.doMock("@/lib/db/db", () => ({
      prisma: {
        account: {
          findFirst: jest.fn().mockResolvedValue({ id: "a1" }),
          deleteMany: jest.fn(),
        },
      },
    }));
    jest.doMock("@/services/auth-provider/account-linking", () => ({
      canUnlinkAccount: jest.fn().mockRejectedValue(new Error("DB down")),
    }));
    const { DELETE } = await import("@/app/api/account/links/[provider]/route");
    const req = new NextRequest("http://localhost/api/account/links/google", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ provider: "google" }) });
    expect(res.status).toBe(500);
  });
});
