/** @jest-environment node */
/**
 * Integration test: GET /api/auth-providers/enabled returns enabled providers
 * with display-only fields and no secret leakage.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { encrypt } from "@/lib/encryption/encryption";

jest.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => Promise<unknown>>(fn: T) => fn,
  revalidateTag: jest.fn(),
}));

let prisma: PrismaClient;
let dbAvailable = false;

const TEST_PROVIDER_ID = `enabled-display-test-${Date.now()}`;

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
    await prisma.authProvider.deleteMany({ where: { providerId: TEST_PROVIDER_ID } });
    await prisma.$disconnect();
  }
});

describe("GET /api/auth-providers/enabled — display-only", () => {
  it("returns enabled providers without leaking secrets", async () => {
    if (!dbAvailable) { return; }

    await prisma.authProvider.create({
      data: {
        providerId: TEST_PROVIDER_ID,
        type: "GOOGLE",
        displayName: "Display Test",
        clientId: "test-client-id",
        encryptedClientSecret: encrypt("should-not-leak"),
        enabled: true,
      },
    });

    try {
      const { GET } = await import("@/app/api/auth-providers/enabled/route");
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.error).toBeNull();
      expect(Array.isArray(body.data)).toBe(true);

      const found = body.data.some(
        (p: { providerId: string }) => p.providerId === TEST_PROVIDER_ID,
      );
      expect(found).toBe(true);

      const json = JSON.stringify(body);
      expect(json).not.toContain("should-not-leak");
      expect(json).not.toContain("encrypted");
    } finally {
      await prisma.authProvider.deleteMany({ where: { providerId: TEST_PROVIDER_ID } });
    }
  });
});
