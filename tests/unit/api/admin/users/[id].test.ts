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
