/** @jest-environment node */
/**
 * Unit tests for PATCH /api/admin/users/[id].
 * Covers status changes, self-protection, and validation.
 */

import { NextRequest } from "next/server";

jest.mock("@/lib/auth/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/db/db", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed"),
}));

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/db";

const mockAuth = auth as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockUserUpdate = prisma.user.update as jest.Mock;

const ADMIN_SESSION = { user: { id: "admin-1", email: "admin@ex.com", role: "ADMIN" } };
const TARGET_USER = {
  id: "user-1",
  email: "target@ex.com",
  role: "USER",
  status: "ACTIVE",
  isActive: true,
};

function makePatchRequest(id: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/admin/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Calls PATCH with the correct Next.js 16 params signature. */
async function callPatch(id: string, body: unknown) {
  const { PATCH } = await import("@/app/api/admin/users/[id]/route");
  return PATCH(makePatchRequest(id, body), { params: Promise.resolve({ id }) });
}

describe("PATCH /api/admin/users/[id] — status field", () => {
  beforeEach(() => jest.clearAllMocks());

  it("updates user status to SUSPENDED", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockUserFindUnique.mockResolvedValue(TARGET_USER);
    mockUserUpdate.mockResolvedValue({ ...TARGET_USER, status: "SUSPENDED" });

    const res = await callPatch("user-1", { status: "SUSPENDED" });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe("SUSPENDED");
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({ status: "SUSPENDED" }),
      }),
    );
  });

  it("updates user status to ACTIVE", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockUserFindUnique.mockResolvedValue({ ...TARGET_USER, status: "SUSPENDED" });
    mockUserUpdate.mockResolvedValue({ ...TARGET_USER, status: "ACTIVE" });

    const res = await callPatch("user-1", { status: "ACTIVE" });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.status).toBe("ACTIVE");
  });

  it("rejects self status change with CANNOT_CHANGE_OWN_STATUS", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockUserFindUnique.mockResolvedValue(TARGET_USER);

    const res = await callPatch("admin-1", { status: "SUSPENDED" });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("CANNOT_CHANGE_OWN_STATUS");
  });

  it("returns 400 INVALID_INPUT for invalid status value", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockUserFindUnique.mockResolvedValue(TARGET_USER);

    const res = await callPatch("user-1", { status: "INVALID" });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_INPUT");
  });
});

describe("PATCH /api/admin/users/[id] — changePassword", () => {
  beforeEach(() => jest.clearAllMocks());

  it("ignores password when changePassword is absent even if password has a value", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockUserFindUnique.mockResolvedValue(TARGET_USER);
    mockUserUpdate.mockResolvedValue({ ...TARGET_USER });

    const res = await callPatch("user-1", { username: "New Name", password: "newpassword123" });

    expect(res.status).toBe(200);
    const updateArgs = mockUserUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateArgs.data).not.toHaveProperty("passwordHash");
  });

  it("ignores password when changePassword is false even if password has a value", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockUserFindUnique.mockResolvedValue(TARGET_USER);
    mockUserUpdate.mockResolvedValue({ ...TARGET_USER });

    const res = await callPatch("user-1", { changePassword: false, password: "newpassword123" });

    expect(res.status).toBe(200);
    const updateArgs = mockUserUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateArgs.data).not.toHaveProperty("passwordHash");
  });

  it("updates password when changePassword is true and password is valid", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockUserFindUnique.mockResolvedValue(TARGET_USER);
    mockUserUpdate.mockResolvedValue({ ...TARGET_USER });

    const res = await callPatch("user-1", { changePassword: true, password: "newpassword123" });

    expect(res.status).toBe(200);
    const updateArgs = mockUserUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateArgs.data).toHaveProperty("passwordHash", "hashed");
  });

  it("returns 400 PASSWORD_REQUIRED when changePassword is true but password is missing", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockUserFindUnique.mockResolvedValue(TARGET_USER);

    const res = await callPatch("user-1", { changePassword: true });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("PASSWORD_REQUIRED");
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 PASSWORD_TOO_SHORT when changePassword is true and password is less than 8 chars", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockUserFindUnique.mockResolvedValue(TARGET_USER);

    const res = await callPatch("user-1", { changePassword: true, password: "short" });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("PASSWORD_TOO_SHORT");
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 PASSWORD_TOO_LONG when changePassword is true and password exceeds 72 chars", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockUserFindUnique.mockResolvedValue(TARGET_USER);

    const longPassword = "a".repeat(73);
    const res = await callPatch("user-1", { changePassword: true, password: longPassword });
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("PASSWORD_TOO_LONG");
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("does not return PASSWORD_TOO_LONG when changePassword is false and password exceeds 72 chars", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockUserFindUnique.mockResolvedValue(TARGET_USER);
    mockUserUpdate.mockResolvedValue({ ...TARGET_USER });

    const longPassword = "a".repeat(73);
    const res = await callPatch("user-1", { changePassword: false, password: longPassword });

    expect(res.status).toBe(200);
    const updateArgs = mockUserUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateArgs.data).not.toHaveProperty("passwordHash");
  });

  it("does not return PASSWORD_TOO_LONG when changePassword is absent and password exceeds 72 chars", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockUserFindUnique.mockResolvedValue(TARGET_USER);
    mockUserUpdate.mockResolvedValue({ ...TARGET_USER });

    const longPassword = "a".repeat(73);
    const res = await callPatch("user-1", { password: longPassword });

    expect(res.status).toBe(200);
    const updateArgs = mockUserUpdate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateArgs.data).not.toHaveProperty("passwordHash");
  });
});

/** Returns the `data` object passed to the most recent `prisma.user.update` call. */
function lastUpdateData(): Record<string, unknown> {
  const calls = mockUserUpdate.mock.calls;
  return (calls[calls.length - 1][0] as { data: Record<string, unknown> }).data;
}

describe("PATCH /api/admin/users/[id] — session revocation markers (spec 045)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockUserUpdate.mockResolvedValue({ ...TARGET_USER });
  });

  it("sets sessionsRevokedAt when an ADMIN is demoted to USER", async () => {
    mockUserFindUnique.mockResolvedValue({ ...TARGET_USER, role: "ADMIN" });

    const res = await callPatch("user-1", { role: "USER" });

    expect(res.status).toBe(200);
    expect(lastUpdateData().sessionsRevokedAt).toBeInstanceOf(Date);
  });

  it.each(["SUSPENDED", "PENDING"])("sets sessionsRevokedAt when an ACTIVE user becomes %s", async (status) => {
    mockUserFindUnique.mockResolvedValue({ ...TARGET_USER, status: "ACTIVE" });

    const res = await callPatch("user-1", { status });

    expect(res.status).toBe(200);
    expect(lastUpdateData().sessionsRevokedAt).toBeInstanceOf(Date);
  });

  it("does not set sessionsRevokedAt when a USER is promoted to ADMIN", async () => {
    mockUserFindUnique.mockResolvedValue({ ...TARGET_USER, role: "USER" });

    await callPatch("user-1", { role: "ADMIN" });

    expect(lastUpdateData()).not.toHaveProperty("sessionsRevokedAt");
  });

  it("does not set sessionsRevokedAt when a suspended user is reactivated", async () => {
    mockUserFindUnique.mockResolvedValue({ ...TARGET_USER, status: "SUSPENDED" });

    await callPatch("user-1", { status: "ACTIVE" });

    expect(lastUpdateData()).not.toHaveProperty("sessionsRevokedAt");
  });

  it("does not set sessionsRevokedAt when the role is unchanged", async () => {
    mockUserFindUnique.mockResolvedValue({ ...TARGET_USER, role: "ADMIN" });

    await callPatch("user-1", { role: "ADMIN" });

    expect(lastUpdateData()).not.toHaveProperty("sessionsRevokedAt");
  });

  it("does not set sessionsRevokedAt when the status is unchanged", async () => {
    mockUserFindUnique.mockResolvedValue({ ...TARGET_USER, status: "ACTIVE" });

    await callPatch("user-1", { status: "ACTIVE" });

    expect(lastUpdateData()).not.toHaveProperty("sessionsRevokedAt");
  });

  it("does not revoke sessions for an email-only change", async () => {
    mockUserFindUnique.mockResolvedValue(TARGET_USER);

    await callPatch("user-1", { email: "new@ex.com" });

    const data = lastUpdateData();
    expect(data).not.toHaveProperty("sessionsRevokedAt");
    expect(data).not.toHaveProperty("passwordChangedAt");
  });

  it("does not revoke sessions for a username-only change", async () => {
    mockUserFindUnique.mockResolvedValue(TARGET_USER);

    await callPatch("user-1", { username: "Renamed" });

    expect(lastUpdateData()).not.toHaveProperty("sessionsRevokedAt");
  });

  it("sets both markers when demoting and changing the password in one request", async () => {
    mockUserFindUnique.mockResolvedValue({ ...TARGET_USER, role: "ADMIN" });

    await callPatch("user-1", { role: "USER", changePassword: true, password: "newpassword123" });

    const data = lastUpdateData();
    expect(data.sessionsRevokedAt).toBeInstanceOf(Date);
    expect(data.passwordChangedAt).toBeInstanceOf(Date);
  });
});

describe("PATCH /api/admin/users/[id] — passwordChangedAt (FR-007)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    mockUserFindUnique.mockResolvedValue(TARGET_USER);
    mockUserUpdate.mockResolvedValue({ ...TARGET_USER });
  });

  it("sets passwordChangedAt when an admin sets a new password", async () => {
    await callPatch("user-1", { changePassword: true, password: "newpassword123" });

    expect(lastUpdateData().passwordChangedAt).toBeInstanceOf(Date);
  });

  it("does not set passwordChangedAt when changePassword is false", async () => {
    await callPatch("user-1", { changePassword: false, password: "newpassword123" });

    expect(lastUpdateData()).not.toHaveProperty("passwordChangedAt");
  });

  it("does not set passwordChangedAt when changePassword is absent", async () => {
    await callPatch("user-1", { username: "Renamed", password: "newpassword123" });

    expect(lastUpdateData()).not.toHaveProperty("passwordChangedAt");
  });
});
