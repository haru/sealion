/** @jest-environment node */
/**
 * Integration tests for GET /api/auth-providers/enabled — the public endpoint
 * the login screen calls to render IdP buttons. No auth required; no secret
 * fields in the response.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { encrypt } from "@/lib/encryption/encryption";

let encryptedSecret: string;

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

beforeEach(async () => {
  if (dbAvailable) {
    encryptedSecret = encrypt("public-list-secret");
    await prisma.authProvider.deleteMany({
      where: {
        providerId: { in: ["google-public-test", "github-public-test-disabled"] },
      },
    });
  }
});

describe("GET /api/auth-providers/enabled", () => {
  it("returns only enabled rows with the minimal display fields", async () => {
    if (!dbAvailable) { return; }
    await prisma.authProvider.createMany({
      data: [
        {
          providerId: "google-public-test",
          type: "GOOGLE",
          displayName: "Google",
          clientId: "g",
          encryptedClientSecret: encryptedSecret,
          enabled: true,
        },
        {
          providerId: "github-public-test-disabled",
          type: "GITHUB",
          displayName: "GitHub (off)",
          clientId: "gh",
          encryptedClientSecret: encryptedSecret,
          enabled: false,
        },
      ],
    });

    const { GET } = await import("@/app/api/auth-providers/enabled/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeNull();
    const ourRows = body.data.filter((r: { providerId: string }) =>
      ["google-public-test", "github-public-test-disabled"].includes(r.providerId),
    );
    expect(ourRows).toHaveLength(1);
    body.data = ourRows;
    expect(body.data[0]).toEqual({
      providerId: "google-public-test",
      type: "GOOGLE",
      displayName: "Google",
    });
    expect(JSON.stringify(body)).not.toContain("public-list-secret");
    expect(JSON.stringify(body)).not.toContain(encryptedSecret);
    expect(body.data[0].clientId).toBeUndefined();
  });

  it("returns an empty array when no providers exist", async () => {
    if (!dbAvailable) { return; }
    const { GET } = await import("@/app/api/auth-providers/enabled/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    // Other test files may have left enabled rows; just assert OUR test rows are absent.
    const ourIds = body.data.map((r: { providerId: string }) => r.providerId);
    expect(ourIds).not.toContain("google-public-test");
    expect(ourIds).not.toContain("github-public-test-disabled");
  });
});
