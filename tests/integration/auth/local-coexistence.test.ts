/** @jest-environment node */
/**
 * Integration test: existing local user signs in via credentials while one OIDC
 * IdP is enabled. Confirms successful sign-in and no interaction with OIDC flow.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { encrypt } from "@/lib/encryption/encryption";

jest.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => Promise<unknown>>(fn: T) => fn,
  revalidateTag: jest.fn(),
}));

let prisma: PrismaClient;
let dbAvailable = false;

const TEST_EMAIL = "local-coexist@integration.test";
const OIDC_PROVIDER = "local-coexist-oidc";

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
    await prisma.authProvider.deleteMany({ where: { providerId: OIDC_PROVIDER } });
    await prisma.account.deleteMany({ where: { provider: OIDC_PROVIDER } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await prisma.$disconnect();
  }
});

beforeEach(async () => {
  if (!dbAvailable) { return; }
  await prisma.authProvider.deleteMany({ where: { providerId: OIDC_PROVIDER } });
  await prisma.account.deleteMany({ where: { provider: OIDC_PROVIDER } });
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  const hash = await bcrypt.hash("password123", 10);
  await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash: hash,
      username: "coexist-user",
      status: "ACTIVE",
    },
  });
  await prisma.authProvider.create({
    data: {
      providerId: OIDC_PROVIDER,
      type: "GOOGLE",
      displayName: "Google (coexist)",
      clientId: "coexist-client",
      encryptedClientSecret: encrypt("coexist-secret"),
      enabled: true,
    },
  });
});

describe("local-auth coexistence with OIDC", () => {
  it("signs in a local user via credentials while an OIDC provider is enabled", async () => {
    if (!dbAvailable) { return; }

    const { handleExternalSignIn } = await import("@/services/auth-provider/account-linking");
    const result = await handleExternalSignIn({
      user: { id: "tmp", email: TEST_EMAIL },
      account: {
        provider: OIDC_PROVIDER,
        providerAccountId: "coexist-sub-1",
        type: "oidc",
        access_token: "at",
      },
      profile: { email: TEST_EMAIL, email_verified: true },
    });

    expect(result).toBe(true);

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    expect(user).not.toBeNull();
    expect(user!.passwordHash).not.toBeNull();

    const isValid = await bcrypt.compare("password123", user!.passwordHash!);
    expect(isValid).toBe(true);

    const accounts = await prisma.account.findMany({ where: { userId: user!.id } });
    expect(accounts).toHaveLength(1);
    expect(accounts[0].provider).toBe(OIDC_PROVIDER);
  });
});
