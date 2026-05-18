/** @jest-environment node */
/**
 * Integration test for the full signIn-callback flow against the real DB.
 * Exercises `handleExternalSignIn` end-to-end: existing-user link creates an
 * Account row; new-user create produces both a User and an Account row.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Inherits CREDENTIALS_ENCRYPTION_KEY from the test runner env.

let prisma: PrismaClient;
let dbAvailable = false;

const TEST_EMAIL_EXISTING = "oidc-existing@integration.test";
const TEST_EMAIL_NEW = "oidc-new@integration.test";
const TEST_PROVIDER_ID = "oidc-callback-test";

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
    await prisma.account.deleteMany({ where: { provider: TEST_PROVIDER_ID } });
    await prisma.user.deleteMany({
      where: { email: { in: [TEST_EMAIL_EXISTING, TEST_EMAIL_NEW] } },
    });
    await prisma.authSettings.deleteMany({ where: { id: "singleton" } });
    await prisma.$disconnect();
  }
});

beforeEach(async () => {
  if (!dbAvailable) { return; }
  await prisma.account.deleteMany({ where: { provider: TEST_PROVIDER_ID } });
  await prisma.user.deleteMany({
    where: { email: { in: [TEST_EMAIL_EXISTING, TEST_EMAIL_NEW] } },
  });
  await prisma.authSettings.deleteMany({ where: { id: "singleton" } });
  await prisma.authSettings.create({
    data: { id: "singleton", allowUserSignup: true, requireEmailVerification: false },
  });
});

function makeAccount(providerAccountId: string) {
  return {
    provider: TEST_PROVIDER_ID,
    providerAccountId,
    type: "oidc" as const,
    access_token: "test-access-token",
    id_token: "test-id-token",
  };
}

describe("oidc signIn callback — integration", () => {
  it("links an existing user to a new IdP Account", async () => {
    if (!dbAvailable) { return; }
    await prisma.user.create({
      data: {
        email: TEST_EMAIL_EXISTING,
        passwordHash: "$2a$10$existinghash",
        username: "existing",
      },
    });

    const { handleExternalSignIn } = await import("@/services/auth-provider/account-linking");
    const result = await handleExternalSignIn({
      user: { id: "tmp", email: TEST_EMAIL_EXISTING },
      account: makeAccount("oidc-sub-existing"),
      profile: { email: TEST_EMAIL_EXISTING, email_verified: true },
    });

    expect(result).toBe(true);
    const accounts = await prisma.account.findMany({
      where: { provider: TEST_PROVIDER_ID, providerAccountId: "oidc-sub-existing" },
    });
    expect(accounts).toHaveLength(1);
  });

  it("creates a new ACTIVE user + Account when signup allowed and email verified", async () => {
    if (!dbAvailable) { return; }
    const { handleExternalSignIn } = await import("@/services/auth-provider/account-linking");
    const result = await handleExternalSignIn({
      user: { id: "tmp", email: TEST_EMAIL_NEW, name: "New User" },
      account: makeAccount("oidc-sub-new"),
      profile: { email: TEST_EMAIL_NEW, email_verified: true, name: "New User" },
    });

    expect(result).toBe(true);
    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL_NEW } });
    expect(user).not.toBeNull();
    expect(user?.passwordHash).toBeNull();
    expect(user?.status).toBe("ACTIVE");
    const accounts = await prisma.account.findMany({
      where: { provider: TEST_PROVIDER_ID, providerAccountId: "oidc-sub-new" },
    });
    expect(accounts).toHaveLength(1);
    expect(accounts[0].userId).toBe(user!.id);
  });
});
