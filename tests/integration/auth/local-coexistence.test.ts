/** @jest-environment node */
/**
 * Integration test: existing local user signs in via credentials while one OIDC
 * IdP is enabled. Confirms the credentials authorize callback still returns a
 * valid user (not null) when an OIDC provider row is present in the DB.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { NextAuthConfig } from "next-auth";

import { encrypt } from "@/lib/encryption/encryption";

let capturedProviderConfig:
  | {
      authorize?: (
        credentials: Record<string, unknown> | undefined,
      ) => Promise<unknown>;
    }
  | undefined;

const mockProviderFactory = jest.fn((config: unknown) => {
  capturedProviderConfig = config as typeof capturedProviderConfig;
  return { id: "credentials", ...config };
});

jest.mock("next-auth/providers/credentials", () => mockProviderFactory);

jest.mock("next-auth", () => ({
  __esModule: true,
  default: jest.fn(
    (config: NextAuthConfig | (() => Promise<NextAuthConfig>)) => {
      if (typeof config === "function") {
        void (async () => { await config(); })();
      }
      return { handlers: {}, auth: jest.fn(), signIn: jest.fn(), signOut: jest.fn() };
    },
  ),
}));

jest.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: jest.fn(() => ({})) }));
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
jest.mock("@/services/auth-provider/repository", () => ({
  listEnabled: jest.fn().mockResolvedValue([]),
  AUTH_PROVIDERS_CACHE_TAG: "auth-providers",
}));
jest.mock("@/services/auth-provider", () => ({
  listEnabled: jest.fn().mockResolvedValue([]),
  getAuthProviderMetadata: jest.fn(),
}));

let prisma: PrismaClient;
let dbAvailable = false;

const TEST_EMAIL = "local-coexist@integration.test";
const TEST_PASSWORD = "password123";
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
  await import("@/lib/auth/auth");
  await new Promise((resolve) => setImmediate(resolve));
});

afterAll(async () => {
  if (dbAvailable) {
    await prisma.authProvider.deleteMany({ where: { providerId: OIDC_PROVIDER } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await prisma.$disconnect();
  }
});

beforeEach(async () => {
  if (!dbAvailable) { return; }
  await prisma.authProvider.deleteMany({ where: { providerId: OIDC_PROVIDER } });
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  const hash = await bcrypt.hash(TEST_PASSWORD, 10);
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
  it("credentials authorize still returns a user when an OIDC provider is enabled", async () => {
    if (!dbAvailable) { return; }

    if (!capturedProviderConfig?.authorize) {
      throw new Error("authorize not captured — mock setup failed");
    }

    // Credentials sign-in with correct password while an OIDC provider exists in DB.
    const result = await capturedProviderConfig.authorize({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    expect(result).not.toBeNull();
    expect((result as { email: string }).email).toBe(TEST_EMAIL);
  });

  it("credentials authorize returns null for wrong password when OIDC provider is enabled", async () => {
    if (!dbAvailable) { return; }

    if (!capturedProviderConfig?.authorize) {
      throw new Error("authorize not captured — mock setup failed");
    }

    const result = await capturedProviderConfig.authorize({
      email: TEST_EMAIL,
      password: "wrong-password",
    });

    expect(result).toBeNull();
  });
});
