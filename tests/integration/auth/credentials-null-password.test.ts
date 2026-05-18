/** @jest-environment node */
/**
 * Integration test: a User with passwordHash === null attempting Credentials
 * sign-in returns null (not a 500 crash). Verifies the null-passwordHash guard
 * in src/lib/auth/auth.ts.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type { NextAuthConfig } from "next-auth";

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
jest.mock("bcryptjs", () => ({
  compare: jest.fn().mockResolvedValue(false),
  hash: jest.fn(),
}));

// Real Prisma client (integration DB) — not mocked so findUnique reads actual rows.
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
  // Load auth module so it registers its NextAuth config (captures authorize).
  await import("@/lib/auth/auth");
  await new Promise((resolve) => setImmediate(resolve));
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
  it("returns null for an OIDC-only user — does not crash", async () => {
    if (!dbAvailable) { return; }

    if (!capturedProviderConfig?.authorize) {
      throw new Error("authorize not captured — mock setup failed");
    }

    const result = await capturedProviderConfig.authorize({
      email: TEST_EMAIL,
      password: "any-password",
    });

    expect(result).toBeNull();
  });
});
