/** @jest-environment node */
/**
 * Integration tests for PATCH /api/admin/auth-providers/[id] and
 * DELETE /api/admin/auth-providers/[id].
 *
 * Covers: auth enforcement, Zod validation, success response shape,
 * 404 NOT_FOUND, 409 PROVIDER_IN_USE, secret re-encryption, and
 * cache invalidation.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

import { encrypt } from "@/lib/encryption/encryption";

const mockAuth = jest.fn();
jest.mock("@/lib/auth/auth", () => ({
  auth: () => mockAuth(),
}));

const mockRevalidateTag = jest.fn();
jest.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => Promise<unknown>>(fn: T) => fn,
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
}));

let prisma: PrismaClient;
let dbAvailable = false;
let createdId: string;

const PROVIDER_ID = "id-route-test-provider";

async function resetProvider() {
  await prisma.account.deleteMany({ where: { provider: PROVIDER_ID } });
  await prisma.authProvider.deleteMany({ where: { providerId: PROVIDER_ID } });
  const row = await prisma.authProvider.create({
    data: {
      providerId: PROVIDER_ID,
      type: "GOOGLE",
      displayName: "Google (id-test)",
      clientId: "test-client-id",
      encryptedClientSecret: encrypt("original-secret"),
      enabled: false,
    },
  });
  createdId = row.id;
}

function adminSession() {
  return { user: { id: "admin-test", email: "admin@test.com", role: "ADMIN" } };
}
function userSession() {
  return { user: { id: "user-test", email: "user@test.com", role: "USER" } };
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
  if (dbAvailable) {
    await prisma.account.deleteMany({ where: { provider: PROVIDER_ID } });
    await prisma.authProvider.deleteMany({ where: { providerId: PROVIDER_ID } });
    await prisma.$disconnect();
  }
});

beforeEach(async () => {
  jest.clearAllMocks();
  if (dbAvailable) { await resetProvider(); }
});

// ─── PATCH ────────────────────────────────────────────────────────────────────

describe("PATCH /api/admin/auth-providers/[id]", () => {
  it("returns 403 when not admin", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue(userSession());
    const { PATCH } = await import("@/app/api/admin/auth-providers/[id]/route");
    const res = await PATCH(patchReq(createdId, { displayName: "New" }), {
      params: Promise.resolve({ id: createdId }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 on Zod validation failure", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue(adminSession());
    const { PATCH } = await import("@/app/api/admin/auth-providers/[id]/route");
    const res = await PATCH(
      patchReq(createdId, { clientSecret: "" }), // too short (min 1)
      { params: Promise.resolve({ id: createdId }) },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("INVALID_INPUT");
  });

  it("returns 404 for unknown id", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue(adminSession());
    const { PATCH } = await import("@/app/api/admin/auth-providers/[id]/route");
    const res = await PATCH(patchReq("nonexistent-id", { displayName: "X" }), {
      params: Promise.resolve({ id: "nonexistent-id" }),
    });
    expect(res.status).toBe(404);
  });

  it("updates displayName and returns 200 without clientSecret in body", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue(adminSession());
    const { PATCH } = await import("@/app/api/admin/auth-providers/[id]/route");
    const res = await PATCH(
      patchReq(createdId, { displayName: "Updated Google", enabled: true }),
      { params: Promise.resolve({ id: createdId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeNull();
    expect(body.data.displayName).toBe("Updated Google");
    expect(body.data.enabled).toBe(true);
    expect(JSON.stringify(body)).not.toContain("original-secret");
  });

  it("re-encrypts clientSecret when provided", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue(adminSession());
    const { PATCH } = await import("@/app/api/admin/auth-providers/[id]/route");
    await PATCH(
      patchReq(createdId, { clientSecret: "new-secret-value" }),
      { params: Promise.resolve({ id: createdId }) },
    );
    const row = await prisma.authProvider.findUnique({ where: { id: createdId } });
    expect(row).not.toBeNull();
    expect(row!.encryptedClientSecret).not.toContain("new-secret-value");
    expect(row!.encryptedClientSecret).not.toBe(encrypt("original-secret"));
  });

  it("calls revalidateTag on success", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue(adminSession());
    const { PATCH } = await import("@/app/api/admin/auth-providers/[id]/route");
    await PATCH(patchReq(createdId, { displayName: "Revalidate Test" }), {
      params: Promise.resolve({ id: createdId }),
    });
    expect(mockRevalidateTag).toHaveBeenCalledWith("auth-providers", "");
  });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe("DELETE /api/admin/auth-providers/[id]", () => {
  it("returns 403 when not admin", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue(userSession());
    const { DELETE } = await import("@/app/api/admin/auth-providers/[id]/route");
    const res = await DELETE(deleteReq(createdId), {
      params: Promise.resolve({ id: createdId }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 for unknown id", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue(adminSession());
    const { DELETE } = await import("@/app/api/admin/auth-providers/[id]/route");
    const res = await DELETE(deleteReq("nonexistent-id"), {
      params: Promise.resolve({ id: "nonexistent-id" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 409 PROVIDER_IN_USE when accounts are linked", async () => {
    if (!dbAvailable) { return; }
    // Create a linked account so deletion should be blocked.
    const user = await prisma.user.create({
      data: { email: "linked-user@test.com", username: "linked", status: "ACTIVE" },
    });
    await prisma.account.create({
      data: {
        provider: PROVIDER_ID,
        providerAccountId: "sub-123",
        type: "oidc",
        userId: user.id,
      },
    });

    mockAuth.mockResolvedValue(adminSession());
    const { DELETE } = await import("@/app/api/admin/auth-providers/[id]/route");
    const res = await DELETE(deleteReq(createdId), {
      params: Promise.resolve({ id: createdId }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("PROVIDER_IN_USE");
    expect(body.errorDetails?.linkedAccountCount).toBeGreaterThan(0);

    // Cleanup linked user.
    await prisma.account.deleteMany({ where: { provider: PROVIDER_ID } });
    await prisma.user.deleteMany({ where: { email: "linked-user@test.com" } });
  });

  it("deletes the provider and returns 204", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue(adminSession());
    const { DELETE } = await import("@/app/api/admin/auth-providers/[id]/route");
    const res = await DELETE(deleteReq(createdId), {
      params: Promise.resolve({ id: createdId }),
    });
    expect(res.status).toBe(204);

    const row = await prisma.authProvider.findUnique({ where: { id: createdId } });
    expect(row).toBeNull();
  });

  it("calls revalidateTag on successful delete", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue(adminSession());
    const { DELETE } = await import("@/app/api/admin/auth-providers/[id]/route");
    await DELETE(deleteReq(createdId), {
      params: Promise.resolve({ id: createdId }),
    });
    expect(mockRevalidateTag).toHaveBeenCalledWith("auth-providers", "");
  });
});
