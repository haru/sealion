/** @jest-environment node */
/**
 * Unit tests for the jwt callback and authorize callback in src/lib/auth.ts.
 * Covers sessionTimeoutMinutes integration (T022) and user status checks (T007).
 */

import type { NextAuthConfig } from "next-auth";

let capturedCallbacks: NextAuthConfig["callbacks"];
let capturedProviderConfig:
  | {
      credentials?: Record<string, unknown>;
      authorize?: (
        credentials: Record<string, unknown> | undefined,
      ) => Promise<unknown>;
    }
  | undefined;

jest.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: jest.fn(() => ({})) }));

jest.mock("bcryptjs", () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn(),
}));

jest.mock("@/lib/auth-settings", () => ({
  getAuthSettings: jest.fn().mockResolvedValue({
    id: "singleton",
    allowUserSignup: true,
    sessionTimeoutMinutes: null,
    updatedAt: new Date(),
  }),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    authSettings: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockProviderFactory = jest.fn((config: unknown) => {
  capturedProviderConfig = config as {
    credentials?: Record<string, unknown>;
    authorize?: (
      credentials: Record<string, unknown> | undefined,
    ) => Promise<unknown>;
  };
  return { id: "credentials", ...config };
});

jest.mock("next-auth/providers/credentials", () => mockProviderFactory);

jest.mock("next-auth", () => ({
  __esModule: true,
  default: jest.fn((config: NextAuthConfig) => {
    capturedCallbacks = config.callbacks;
    return { handlers: {}, auth: jest.fn(), signIn: jest.fn(), signOut: jest.fn() };
  }),
}));

import { getAuthSettings } from "@/lib/auth-settings";
import { prisma } from "@/lib/db";

const mockGetAuthSettings = getAuthSettings as jest.Mock;
const mockAuthSettingsFindUnique = prisma.authSettings.findUnique as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;


function makeToken(extra: Record<string, unknown> = {}) {
  return { sub: "user-1", id: "user-1", role: "USER", ...extra };
}

const ACTIVE_USER = {
  id: "user-1",
  email: "user@example.com",
  passwordHash: "$2a$12$hash",
  role: "USER",
  status: "ACTIVE",
  isActive: true,
  username: "TestUser",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const PENDING_USER = {
  ...ACTIVE_USER,
  id: "user-2",
  status: "PENDING",
};

const SUSPENDED_USER = {
  ...ACTIVE_USER,
  id: "user-3",
  status: "SUSPENDED",
};

describe("jwt callback — sessionTimeoutMinutes", () => {
  const MOCKED_NOW = 1_700_000_000_000;

  beforeAll(async () => {
    await import("@/lib/auth");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(MOCKED_NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sets token.exp on signIn when sessionTimeoutMinutes is non-null", async () => {
    mockGetAuthSettings.mockResolvedValue({
      id: "singleton",
      allowUserSignup: true,
      sessionTimeoutMinutes: 60,
      updatedAt: new Date(),
    });

    const jwt = capturedCallbacks?.jwt;
    if (!jwt) throw new Error("jwt callback not captured");

    const token = await jwt({
      token: makeToken(),
      user: { id: "user-1", email: "u@ex.com", role: "USER" } as unknown as never,
      trigger: "signIn",
      account: null,
      session: undefined,
    });

    const expectedExp = Math.floor(MOCKED_NOW / 1000) + 60 * 60;
    expect(token.exp).toBe(expectedExp);
  });

  it("does NOT override token.exp on signIn when sessionTimeoutMinutes is null", async () => {
    mockGetAuthSettings.mockResolvedValue({
      id: "singleton",
      allowUserSignup: true,
      sessionTimeoutMinutes: null,
      updatedAt: new Date(),
    });

    const jwt = capturedCallbacks?.jwt;
    if (!jwt) throw new Error("jwt callback not captured");

    const token = await jwt({
      token: makeToken(),
      user: { id: "user-1", email: "u@ex.com", role: "USER" } as unknown as never,
      trigger: "signIn",
      account: null,
      session: undefined,
    });

    expect(token.exp).toBeUndefined();
  });

  it("does NOT call getAuthSettings when trigger is 'update' (EC-003)", async () => {
    const jwt = capturedCallbacks?.jwt;
    if (!jwt) throw new Error("jwt callback not captured");

    await jwt({
      token: makeToken(),
      user: null as unknown as never,
      trigger: "update",
      account: null,
      session: undefined,
    });

    expect(mockGetAuthSettings).not.toHaveBeenCalled();
  });

  it("does NOT call getAuthSettings when trigger is undefined (EC-003)", async () => {
    const jwt = capturedCallbacks?.jwt;
    if (!jwt) throw new Error("jwt callback not captured");

    await jwt({
      token: makeToken(),
      user: null as unknown as never,
      trigger: undefined,
      account: null,
      session: undefined,
    });

    expect(mockGetAuthSettings).not.toHaveBeenCalled();
  });

  it("sets token.id and token.role from user on signIn", async () => {
    mockGetAuthSettings.mockResolvedValue({
      id: "singleton",
      allowUserSignup: true,
      sessionTimeoutMinutes: null,
      updatedAt: new Date(),
    });

    const jwt = capturedCallbacks?.jwt;
    if (!jwt) throw new Error("jwt callback not captured");

    const token = await jwt({
      token: makeToken(),
      user: { id: "user-42", email: "u@ex.com", role: "ADMIN" } as unknown as never,
      trigger: "signIn",
      account: null,
      session: undefined,
    });

    expect(token.id).toBe("user-42");
    expect(token.role).toBe("ADMIN");
  });
});

describe("authorize callback — user status checks", () => {
  beforeAll(async () => {
    await import("@/lib/auth");
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws EMAIL_NOT_VERIFIED for user with status PENDING", async () => {
    mockUserFindUnique.mockResolvedValue(PENDING_USER);

    if (!capturedProviderConfig?.authorize) throw new Error("authorize not captured");

    await expect(
      capturedProviderConfig.authorize({
        email: "pending@example.com",
        password: "password123",
      }),
    ).rejects.toThrow("EMAIL_NOT_VERIFIED");
  });

  it("returns null for user with status SUSPENDED", async () => {
    mockUserFindUnique.mockResolvedValue(SUSPENDED_USER);

    if (!capturedProviderConfig?.authorize) throw new Error("authorize not captured");

    const result = await capturedProviderConfig.authorize({
      email: "suspended@example.com",
      password: "password123",
    });

    expect(result).toBeNull();
  });

  it("proceeds normally for user with status ACTIVE", async () => {
    mockUserFindUnique.mockResolvedValue(ACTIVE_USER);

    if (!capturedProviderConfig?.authorize) throw new Error("authorize not captured");

    const result = await capturedProviderConfig.authorize({
      email: "user@example.com",
      password: "password123",
    });

    expect(result).toEqual({ id: "user-1", email: "user@example.com", role: "USER" });
  });
});

describe("jwt callback — passwordChangedAt session invalidation", () => {
  const MOCKED_NOW = 1_700_000_000_000;

  beforeAll(async () => {
    await import("@/lib/auth");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(MOCKED_NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("rejects session when token.iat < user.passwordChangedAt", async () => {
    const passwordChangedAtMs = MOCKED_NOW + 60_000;
    mockUserFindUnique.mockResolvedValue({
      ...ACTIVE_USER,
      passwordChangedAt: new Date(passwordChangedAtMs),
    });

    const jwt = capturedCallbacks?.jwt;
    if (!jwt) throw new Error("jwt callback not captured");

    const token = await jwt({
      token: makeToken({ iat: Math.floor(MOCKED_NOW / 1000) }),
      user: null as unknown as never,
      trigger: undefined,
      account: null,
      session: undefined,
    });

    expect(token).toEqual({});
  });

  it("allows session when token.iat >= user.passwordChangedAt", async () => {
    const passwordChangedAtMs = MOCKED_NOW - 60_000;
    mockUserFindUnique.mockResolvedValue({
      ...ACTIVE_USER,
      passwordChangedAt: new Date(passwordChangedAtMs),
    });

    const jwt = capturedCallbacks?.jwt;
    if (!jwt) throw new Error("jwt callback not captured");

    const token = await jwt({
      token: makeToken({ iat: Math.floor(MOCKED_NOW / 1000) }),
      user: null as unknown as never,
      trigger: undefined,
      account: null,
      session: undefined,
    });

    expect(token.id).toBe("user-1");
  });

  it("allows session when passwordChangedAt is null (backward compat)", async () => {
    mockUserFindUnique.mockResolvedValue({
      ...ACTIVE_USER,
      passwordChangedAt: null,
    });

    const jwt = capturedCallbacks?.jwt;
    if (!jwt) throw new Error("jwt callback not captured");

    const token = await jwt({
      token: makeToken({ iat: Math.floor(MOCKED_NOW / 1000) }),
      user: null as unknown as never,
      trigger: undefined,
      account: null,
      session: undefined,
    });

    expect(token.id).toBe("user-1");
  });

  it("allows session when user is not found (token has no sub)", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const jwt = capturedCallbacks?.jwt;
    if (!jwt) throw new Error("jwt callback not captured");

    const token = await jwt({
      token: makeToken({ sub: undefined }),
      user: null as unknown as never,
      trigger: undefined,
      account: null,
      session: undefined,
    });

    expect(token.id).toBe("user-1");
  });
});
