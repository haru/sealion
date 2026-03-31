/** @jest-environment node */
import { NextRequest } from "next/server";

jest.mock("@/lib/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/auth-settings", () => ({
  getAuthSettings: jest.fn(),
}));
jest.mock("@/lib/db", () => ({
  prisma: {
    authSettings: {
      upsert: jest.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { getAuthSettings } from "@/lib/auth-settings";
import { prisma } from "@/lib/db";

const mockAuth = auth as jest.Mock;
const mockGetAuthSettings = getAuthSettings as jest.Mock;
const mockUpsert = prisma.authSettings.upsert as jest.Mock;

const ADMIN_SESSION = { user: { id: "admin-1", email: "admin@ex.com", role: "ADMIN" } };
const USER_SESSION = { user: { id: "user-1", email: "user@ex.com", role: "USER" } };

const DEFAULT_SETTINGS = {
  id: "singleton",
  allowUserSignup: true,
  sessionTimeoutMinutes: null,
  updatedAt: new Date(),
};

function makeGetRequest(): NextRequest {
  return new NextRequest("http://localhost/api/admin/auth-settings");
}

function makePatchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/auth-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── GET ─────────────────────────────────────────────────────────────────────

describe("GET /api/admin/auth-settings", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/auth-settings/route");
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 when non-ADMIN", async () => {
    mockAuth.mockResolvedValue(USER_SESSION);
    const { GET } = await import("@/app/api/admin/auth-settings/route");
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });

  it("returns 200 with default settings when ADMIN", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockGetAuthSettings.mockResolvedValue(DEFAULT_SETTINGS);
    const { GET } = await import("@/app/api/admin/auth-settings/route");
    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual({ allowUserSignup: true, sessionTimeoutMinutes: null });
    expect(json.error).toBeNull();
  });
});

// ─── PATCH ────────────────────────────────────────────────────────────────────

describe("PATCH /api/admin/auth-settings", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/admin/auth-settings/route");
    const res = await PATCH(makePatchRequest({}));
    expect(res.status).toBe(401);
  });

  it("returns 403 when non-ADMIN", async () => {
    mockAuth.mockResolvedValue(USER_SESSION);
    const { PATCH } = await import("@/app/api/admin/auth-settings/route");
    const res = await PATCH(makePatchRequest({}));
    expect(res.status).toBe(403);
  });

  it("returns 200 with updated allowUserSignup", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockUpsert.mockResolvedValue({ ...DEFAULT_SETTINGS, allowUserSignup: false });
    const { PATCH } = await import("@/app/api/admin/auth-settings/route");
    const res = await PATCH(makePatchRequest({ allowUserSignup: false }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.allowUserSignup).toBe(false);
  });

  it("returns 200 with empty body (no changes)", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockUpsert.mockResolvedValue(DEFAULT_SETTINGS);
    const { PATCH } = await import("@/app/api/admin/auth-settings/route");
    const res = await PATCH(makePatchRequest({}));
    expect(res.status).toBe(200);
  });

  it("ignores unknown fields", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockUpsert.mockResolvedValue(DEFAULT_SETTINGS);
    const { PATCH } = await import("@/app/api/admin/auth-settings/route");
    const res = await PATCH(makePatchRequest({ unknownField: "value", allowUserSignup: true }));
    expect(res.status).toBe(200);
  });

  it("returns 400 INVALID_TIMEOUT for invalid sessionTimeoutMinutes", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { PATCH } = await import("@/app/api/admin/auth-settings/route");
    const res = await PATCH(makePatchRequest({ sessionTimeoutMinutes: 999 }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_TIMEOUT");
  });

  it("returns 200 with valid sessionTimeoutMinutes null", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockUpsert.mockResolvedValue({ ...DEFAULT_SETTINGS, sessionTimeoutMinutes: null });
    const { PATCH } = await import("@/app/api/admin/auth-settings/route");
    const res = await PATCH(makePatchRequest({ sessionTimeoutMinutes: null }));
    expect(res.status).toBe(200);
  });

  it("returns 200 with valid sessionTimeoutMinutes 60", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockUpsert.mockResolvedValue({ ...DEFAULT_SETTINGS, sessionTimeoutMinutes: 60 });
    const { PATCH } = await import("@/app/api/admin/auth-settings/route");
    const res = await PATCH(makePatchRequest({ sessionTimeoutMinutes: 60 }));
    expect(res.status).toBe(200);
  });

  it("returns 200 with valid sessionTimeoutMinutes 129600", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockUpsert.mockResolvedValue({ ...DEFAULT_SETTINGS, sessionTimeoutMinutes: 129600 });
    const { PATCH } = await import("@/app/api/admin/auth-settings/route");
    const res = await PATCH(makePatchRequest({ sessionTimeoutMinutes: 129600 }));
    expect(res.status).toBe(200);
  });

  it("returns 400 INVALID_INPUT for null JSON body", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { PATCH } = await import("@/app/api/admin/auth-settings/route");
    const res = await PATCH(makePatchRequest(null));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_INPUT");
  });

  it("returns 400 INVALID_INPUT for non-object JSON body (string)", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { PATCH } = await import("@/app/api/admin/auth-settings/route");
    const res = await PATCH(makePatchRequest("not-an-object"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_INPUT");
  });

  it("returns 400 INVALID_INPUT for array JSON body", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const { PATCH } = await import("@/app/api/admin/auth-settings/route");
    const res = await PATCH(makePatchRequest([1, 2, 3]));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_INPUT");
  });
});
