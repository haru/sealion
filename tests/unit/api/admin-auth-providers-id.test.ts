/** @jest-environment node */
/**
 * Unit tests for PATCH and DELETE /api/admin/auth-providers/[id] (no DB required).
 */

import { NextRequest } from "next/server";

const mockRevalidateTag = jest.fn();
jest.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => Promise<unknown>>(fn: T) => fn,
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
}));

function mockAuth(session: unknown) {
  jest.resetModules();
  mockRevalidateTag.mockClear();
  jest.doMock("@/lib/auth/auth", () => ({
    auth: jest.fn().mockResolvedValue(session),
  }));
}

function mockRepository(overrides: Record<string, unknown>) {
  jest.doMock("@/services/auth-provider/repository", () => overrides);
}

function mockSchema(safeParseResult: { success: boolean; data?: unknown; error?: { issues: unknown[] } }) {
  jest.doMock("@/services/auth-provider/schemas", () => ({
    AuthProviderUpdateSchema: { safeParse: () => safeParseResult },
    validateUpdateIssuerUrl: jest.fn(),
  }));
}

function patchReq(id: string, body: object) {
  return new NextRequest(`http://localhost/api/admin/auth-providers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function deleteReq(id: string) {
  return new NextRequest(`http://localhost/api/admin/auth-providers/${id}`, {
    method: "DELETE",
  });
}

const adminSession = { user: { id: "a1", email: "a@t.com", role: "ADMIN" } };
const userSession = { user: { id: "u1", email: "u@t.com", role: "USER" } };

const baseRecord = {
  id: "rec1",
  providerId: "google",
  type: "GOOGLE",
  displayName: "Google",
  enabled: true,
  issuerUrl: null,
  clientId: "c",
  scope: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

describe("PATCH /api/admin/auth-providers/[id] — unit (no DB required)", () => {
  test("returns 403 when not admin", async () => {
    mockAuth(userSession);
    mockRepository({ findById: jest.fn(), update: jest.fn() });
    mockSchema({ success: true, data: {} });
    const { PATCH } = await import("@/app/api/admin/auth-providers/[id]/route");
    const res = await PATCH(patchReq("id1", { displayName: "X" }), {
      params: Promise.resolve({ id: "id1" }),
    });
    expect(res.status).toBe(403);
  });

  test("returns 400 when body is not JSON", async () => {
    mockAuth(adminSession);
    mockRepository({ findById: jest.fn(), update: jest.fn() });
    mockSchema({ success: true, data: {} });
    const { PATCH } = await import("@/app/api/admin/auth-providers/[id]/route");
    const req = new NextRequest("http://localhost/api/admin/auth-providers/id1", {
      method: "PATCH",
      body: "not-json{{{",
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "id1" }) });
    expect(res.status).toBe(400);
  });

  test("returns 400 when Zod validation fails", async () => {
    mockAuth(adminSession);
    mockRepository({ findById: jest.fn(), update: jest.fn() });
    mockSchema({ success: false, error: { issues: [] } });
    const { PATCH } = await import("@/app/api/admin/auth-providers/[id]/route");
    const res = await PATCH(patchReq("id1", { clientSecret: "" }), {
      params: Promise.resolve({ id: "id1" }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 404 when provider not found", async () => {
    mockAuth(adminSession);
    mockRepository({
      findById: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    });
    mockSchema({ success: true, data: { displayName: "X" } });
    const { PATCH } = await import("@/app/api/admin/auth-providers/[id]/route");
    const res = await PATCH(patchReq("nonexistent", { displayName: "X" }), {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    expect(res.status).toBe(404);
  });

  test("returns 200 on successful update", async () => {
    mockAuth(adminSession);
    mockRepository({
      findById: jest.fn().mockResolvedValue(baseRecord),
      update: jest.fn().mockResolvedValue({ ...baseRecord, displayName: "Updated" }),
    });
    mockSchema({ success: true, data: { displayName: "Updated" } });
    const { PATCH } = await import("@/app/api/admin/auth-providers/[id]/route");
    const res = await PATCH(patchReq("rec1", { displayName: "Updated" }), {
      params: Promise.resolve({ id: "rec1" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.displayName).toBe("Updated");
  });

  test("calls revalidateTag on successful update", async () => {
    mockAuth(adminSession);
    mockRepository({
      findById: jest.fn().mockResolvedValue(baseRecord),
      update: jest.fn().mockResolvedValue({ ...baseRecord, displayName: "X" }),
    });
    mockSchema({ success: true, data: { displayName: "X" } });
    const { PATCH } = await import("@/app/api/admin/auth-providers/[id]/route");
    await PATCH(patchReq("rec1", { displayName: "X" }), {
      params: Promise.resolve({ id: "rec1" }),
    });
    expect(mockRevalidateTag).toHaveBeenCalled();
  });

  test("returns 500 on unexpected error", async () => {
    mockAuth(adminSession);
    mockRepository({
      findById: jest.fn().mockResolvedValue(baseRecord),
      update: jest.fn().mockRejectedValue(new Error("DB down")),
    });
    mockSchema({ success: true, data: { displayName: "X" } });
    const { PATCH } = await import("@/app/api/admin/auth-providers/[id]/route");
    const res = await PATCH(patchReq("rec1", { displayName: "X" }), {
      params: Promise.resolve({ id: "rec1" }),
    });
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/admin/auth-providers/[id] — unit (no DB required)", () => {
  test("returns 403 when not admin", async () => {
    mockAuth(userSession);
    mockRepository({ findById: jest.fn(), remove: jest.fn(), countLinkedAccounts: jest.fn() });
    const { DELETE } = await import("@/app/api/admin/auth-providers/[id]/route");
    const res = await DELETE(deleteReq("id1"), {
      params: Promise.resolve({ id: "id1" }),
    });
    expect(res.status).toBe(403);
  });

  test("returns 404 when provider not found", async () => {
    mockAuth(adminSession);
    mockRepository({
      findById: jest.fn().mockResolvedValue(null),
      remove: jest.fn(),
      countLinkedAccounts: jest.fn(),
    });
    const { DELETE } = await import("@/app/api/admin/auth-providers/[id]/route");
    const res = await DELETE(deleteReq("nonexistent"), {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    expect(res.status).toBe(404);
  });

  test("returns 409 PROVIDER_IN_USE when linked accounts exist", async () => {
    mockAuth(adminSession);
    mockRepository({
      findById: jest.fn().mockResolvedValue(baseRecord),
      countLinkedAccounts: jest.fn().mockResolvedValue(5),
      remove: jest.fn(),
    });
    const { DELETE } = await import("@/app/api/admin/auth-providers/[id]/route");
    const res = await DELETE(deleteReq("rec1"), {
      params: Promise.resolve({ id: "rec1" }),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("PROVIDER_IN_USE");
  });

  test("returns 204 on successful delete", async () => {
    mockAuth(adminSession);
    mockRepository({
      findById: jest.fn().mockResolvedValue(baseRecord),
      countLinkedAccounts: jest.fn().mockResolvedValue(0),
      remove: jest.fn().mockResolvedValue(undefined),
    });
    const { DELETE } = await import("@/app/api/admin/auth-providers/[id]/route");
    const res = await DELETE(deleteReq("rec1"), {
      params: Promise.resolve({ id: "rec1" }),
    });
    expect(res.status).toBe(204);
  });

  test("calls revalidateTag on successful delete", async () => {
    mockAuth(adminSession);
    mockRepository({
      findById: jest.fn().mockResolvedValue(baseRecord),
      countLinkedAccounts: jest.fn().mockResolvedValue(0),
      remove: jest.fn().mockResolvedValue(undefined),
    });
    const { DELETE } = await import("@/app/api/admin/auth-providers/[id]/route");
    await DELETE(deleteReq("rec1"), {
      params: Promise.resolve({ id: "rec1" }),
    });
    expect(mockRevalidateTag).toHaveBeenCalled();
  });

  test("returns 500 on unexpected error", async () => {
    mockAuth(adminSession);
    mockRepository({
      findById: jest.fn().mockResolvedValue(baseRecord),
      countLinkedAccounts: jest.fn().mockResolvedValue(0),
      remove: jest.fn().mockRejectedValue(new Error("DB down")),
    });
    const { DELETE } = await import("@/app/api/admin/auth-providers/[id]/route");
    const res = await DELETE(deleteReq("rec1"), {
      params: Promise.resolve({ id: "rec1" }),
    });
    expect(res.status).toBe(500);
  });
});
