/** @jest-environment node */
/**
 * Integration test for cross-IdP linking: same email signs in via two different
 * providers resulting in one User row with two Account rows.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;
let dbAvailable = false;

const TEST_EMAIL = "cross-idp@integration.test";
const PROVIDER_A = "cross-idp-google";
const PROVIDER_B = "cross-idp-github";

beforeAll(async () => {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  prisma = new PrismaClient({ adapter });
  try {
    await prisma.$connect();
    await prisma.account.count();
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (dbAvailable) {
    await prisma.account.deleteMany({
      where: { provider: { in: [PROVIDER_A, PROVIDER_B] } },
    });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await prisma.authSettings.deleteMany({ where: { id: "singleton" } });
    await prisma.$disconnect();
  }
});

beforeEach(async () => {
  if (!dbAvailable) { return; }
  await prisma.account.deleteMany({
    where: { provider: { in: [PROVIDER_A, PROVIDER_B] } },
  });
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  await prisma.authSettings.deleteMany({ where: { id: "singleton" } });
  await prisma.authSettings.create({
    data: { id: "singleton", allowUserSignup: true, requireEmailVerification: false },
  });
});

describe("cross-IdP linking — integration", () => {
  it("creates one User and two Accounts when the same email signs in via two providers", async () => {
    if (!dbAvailable) { return; }

    const { handleExternalSignIn } = await import("@/services/auth-provider/account-linking");

    const resultA = await handleExternalSignIn({
      user: { id: "tmp", email: TEST_EMAIL, name: "Cross User" },
      account: {
        provider: PROVIDER_A,
        providerAccountId: "google-sub-1",
        type: "oidc",
        access_token: "at-a",
        id_token: "idt-a",
      },
      profile: { email: TEST_EMAIL, email_verified: true, name: "Cross User" },
    });
    expect(resultA).toBe(true);

    const resultB = await handleExternalSignIn({
      user: { id: "tmp", email: TEST_EMAIL, name: "Cross User" },
      account: {
        provider: PROVIDER_B,
        providerAccountId: "github-sub-1",
        type: "oauth",
        access_token: "at-b",
      },
      profile: { email: TEST_EMAIL, email_verified: true, name: "Cross User" },
    });
    expect(resultB).toBe(true);

    const users = await prisma.user.findMany({ where: { email: TEST_EMAIL } });
    expect(users).toHaveLength(1);

    const accounts = await prisma.account.findMany({
      where: { userId: users[0].id },
    });
    expect(accounts).toHaveLength(2);

    const providers = accounts.map((a) => a.provider).sort();
    expect(providers).toEqual([PROVIDER_A, PROVIDER_B]);
  });
});
