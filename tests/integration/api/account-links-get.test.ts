/** @jest-environment node */
/**
 * Integration test for GET /api/account/links.
 * Returns the calling user's linked Accounts; requires auth.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

import { encrypt } from "@/lib/encryption/encryption";

const mockAuth = jest.fn();
jest.mock("@/lib/auth/auth", () => ({
  auth: () => mockAuth(),
}));

let prisma: PrismaClient;
let dbAvailable = false;

const TEST_USER_ID = "account-links-user-001";
const TEST_EMAIL = "account-links-get@integration.test";
const TEST_PROVIDER = "account-links-get-provider";

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
      username: "links-user",
      status: "ACTIVE",
    },
  });
});

describe("GET /api/account/links", () => {
  it("returns 401 when unauthenticated", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue(null);
    const { GET } = await import("@/app/api/account/links/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns linked accounts for the authenticated user", async () => {
    if (!dbAvailable) { return; }
    mockAuth.mockResolvedValue({
      user: { id: TEST_USER_ID, email: TEST_EMAIL, role: "USER" },
    });
    await prisma.account.create({
      data: {
        userId: TEST_USER_ID,
        provider: TEST_PROVIDER,
        providerAccountId: "sub-1",
        type: "oidc",
      },
    });
    const { GET } = await import("@/app/api/account/links/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    const ours = body.data.find((a: { provider: string }) => a.provider === TEST_PROVIDER);
    expect(ours).toBeDefined();
    expect(ours).not.toHaveProperty("access_token");
    expect(ours).not.toHaveProperty("refresh_token");
  });
});
