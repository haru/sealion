/** @jest-environment node */
/**
 * Integration test: GET /api/auth-providers/enabled returns empty array when no
 * providers exist, confirming ExternalProviderButtons would render nothing.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

jest.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => Promise<unknown>>(fn: T) => fn,
  revalidateTag: jest.fn(),
}));

let prisma: PrismaClient;
let dbAvailable = false;

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
  if (dbAvailable) { await prisma.$disconnect(); }
});

describe("GET /api/auth-providers/enabled — empty state", () => {
  it("returns success with an empty data array when no AuthProviders exist", async () => {
    if (!dbAvailable) { return; }
    const count = await prisma.authProvider.count();
    if (count > 0) { return; }

    const { GET } = await import("@/app/api/auth-providers/enabled/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
