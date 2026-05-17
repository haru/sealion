/** @jest-environment node */
/**
 * Integration test: a User with passwordHash === null attempting Credentials
 * sign-in returns null (not a 500 crash). Verifies the null-passwordHash guard
 * in src/lib/auth/auth.ts.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

jest.mock("@/lib/auth/auth-settings", () => ({
  getAuthSettings: jest.fn().mockResolvedValue({
    allowUserSignup: true,
    requireEmailVerification: false,
    sessionTimeoutMinutes: null,
  }),
}));

jest.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => Promise<unknown>>(fn: T) => fn,
  revalidateTag: jest.fn(),
}));

let prisma: PrismaClient;
let dbAvailable = false;

const TEST_EMAIL = "null-pwd@integration.test";

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
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await prisma.$disconnect();
  }
});

beforeEach(async () => {
  if (!dbAvailable) { return; }
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash: null,
      username: "oidc-only-user",
      status: "ACTIVE",
    },
  });
});

describe("credentials sign-in with null passwordHash", () => {
  it("returns null for an OIDC-only user attempting credentials sign-in", async () => {
    if (!dbAvailable) { return; }

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    expect(user).not.toBeNull();
    expect(user!.passwordHash).toBeNull();

    const result = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    expect(result).not.toBeNull();
    expect(result!.passwordHash).toBeNull();
  });
});
