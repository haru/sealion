/** @jest-environment node */
/**
 * Integration test for DELETE /api/account/links/[provider].
 * Covers success, LAST_AUTH_METHOD, and NOT_FOUND.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

const mockAuth = jest.fn();
jest.mock("@/lib/auth/auth", () => ({
  auth: () => mockAuth(),
}));

let prisma: PrismaClient;
let dbAvailable = false;

const TEST_USER_ID = "links-delete-user-001";
const TEST_EMAIL = "links-delete@integration.test";
const PROVIDER_A = "links-delete-google";
const PROVIDER_B = "links-delete-github";

beforeAll(async () => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  prisma = new PrismaClient({ adapter });
  try {
    await prisma.$connect();
    await prisma.user.count();
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (dbAvailable) {
    await prisma.account.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
    await prisma.$disconnect();
  }
});

beforeEach(async () => {
  jest.clearAllMocks();
  if (!dbAvailable) { return; }
  await prisma.account.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  await prisma.user.create({
    data: {
      id: TEST_USER_ID,
      email: TEST_EMAIL,
      passwordHash: null,
      username: "links-del-user",
      status: "ACTIVE",
    },
  });
});

describe("DELETE /api/account/links/[provider]", () => {
  it("returns 401 when unauthenticated", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue(null);
    const { DELETE } = await import("@/app/api/account/links/[provider]/route");
    const req = new NextRequest("http://localhost/api/account/links/google", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ provider: "google" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 LAST_AUTH_METHOD when unlinking the only auth method for OIDC-only user", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue({
      user: { id: TEST_USER_ID, email: TEST_EMAIL, role: "USER" },
    });
    await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        provider: PROVIDER_A,
        providerAccountId: "sub-a",
        type: "oidc",
      },
    });
    const { DELETE } = await import("@/app/api/account/links/[provider]/route");
    const req = new NextRequest("http://localhost/api/account/links/links-delete-google", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ provider: PROVIDER_A }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("LAST_AUTH_METHOD");
  });

  it("returns 404 NOT_FOUND when no matching Account exists", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue({
      user: { id: TEST_USER_ID, email: TEST_EMAIL, role: "USER" },
    });
    const { DELETE } = await import("@/app/api/account/links/[provider]/route");
    const req = new NextRequest("http://localhost/api/account/links/nonexistent", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ provider: "nonexistent" }) });
    expect(res.status).toBe(404);
  });

  it("returns 204 on success when multiple auth methods exist", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue({
      user: { id: TEST_USER_ID, email: TEST_EMAIL, role: "USER" },
    });
    await prisma.account.create({
      data: { userId: TEST_USER_ID, provider: PROVIDER_A, providerAccountId: "sub-a", type: "oidc" },
    });
    await prisma.account.create({
      data: { userId: TEST_USER_ID, provider: PROVIDER_B, providerAccountId: "sub-b", type: "oauth" },
    });
    const { DELETE } = await import("@/app/api/account/links/[provider]/route");
    const req = new NextRequest(`http://localhost/api/account/links/${PROVIDER_A}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ provider: PROVIDER_A }) });
    expect(res.status).toBe(204);
    const remaining = await prisma.account.findMany({ where: { userId: TEST_USER_ID } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].provider).toBe(PROVIDER_B);
  });
});
