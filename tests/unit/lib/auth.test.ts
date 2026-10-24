/** @jest-environment node */
/**
 * Unit tests for the jwt callback and authorize callback in src/lib/auth.ts.
 * Covers per-request session validation (spec 045): revocation, password change,
 * idle timeout, activity updates, and user status checks on authorize.
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

jest.mock("@/lib/auth/auth-settings", () => ({
  getAuthSettings: jest.fn().mockResolvedValue({
    id: "singleton",
    allowUserSignup: true,
    sessionTimeoutMinutes: null,
    updatedAt: new Date(),
  }),
  getSessionTimeoutMinutes: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/db/db", () => ({
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
  default: jest.fn((config: NextAuthConfig | (() => Promise<NextAuthConfig>)) => {
    if (typeof config === "function") {
      // Async config (post-OIDC refactor): resolve once at module load time
      // so the test suite still gets a snapshot of the callbacks.
      void (async () => {
        const resolved = await config();
        capturedCallbacks = resolved.callbacks;
      })();
    } else {
      capturedCallbacks = config.callbacks;
    }
    return { handlers: {}, auth: jest.fn(), signIn: jest.fn(), signOut: jest.fn() };
  }),
}));

// Stub the auth-provider repository so the async config can resolve without DB.
jest.mock("@/services/auth-provider/repository", () => ({
  listEnabled: jest.fn().mockResolvedValue([]),
  AUTH_PROVIDERS_CACHE_TAG: "auth-providers",
}));

jest.mock("@/services/auth-provider", () => ({
  listEnabled: jest.fn().mockResolvedValue([]),
  getAuthProviderMetadata: jest.fn(),
}));

import { getAuthSettings, getSessionTimeoutMinutes } from "@/lib/auth/auth-settings";
import { prisma } from "@/lib/db/db";

const mockGetAuthSettings = getAuthSettings as jest.Mock;
const mockGetSessionTimeoutMinutes = getSessionTimeoutMinutes as jest.Mock;
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

const MOCKED_NOW = 1_700_000_000_000;
const MINUTE = 60_000;

type JwtCallback = NonNullable<NonNullable<NextAuthConfig["callbacks"]>["jwt"]>;
type JwtArgs = Parameters<JwtCallback>[0];

/** DB row returned by the per-request user lookup. */
function dbUser(extra: Record<string, unknown> = {}) {
  return {
    role: "USER",
    status: "ACTIVE",
    passwordChangedAt: null,
    sessionsRevokedAt: null,
    useGravatar: false,
    ...extra,
  };
}

/** Sets the configured idle timeout for both settings accessors. */
function setTimeoutMinutes(minutes: number | null) {
  mockGetSessionTimeoutMinutes.mockResolvedValue(minutes);
  mockGetAuthSettings.mockResolvedValue({
    id: "singleton",
    allowUserSignup: true,
    sessionTimeoutMinutes: minutes,
    updatedAt: new Date(),
  });
}

async function runJwt(args: Partial<JwtArgs> & { token: Record<string, unknown> }) {
  const jwt = capturedCallbacks?.jwt;
  if (!jwt) throw new Error("jwt callback not captured");
  return jwt({
    user: undefined as unknown as never,
    trigger: undefined,
    account: null,
    session: undefined,
    ...args,
  } as JwtArgs);
}

function sessionToken(extra: Record<string, unknown> = {}) {
  return makeToken({ authTime: MOCKED_NOW - MINUTE, lastActivityAt: MOCKED_NOW - MINUTE, ...extra });
}

describe("jwt callback — per-request session validation", () => {
  beforeAll(async () => {
    await import("@/lib/auth/auth");
    await new Promise((resolve) => setImmediate(resolve));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(MOCKED_NOW);
    setTimeoutMinutes(null);
    mockUserFindUnique.mockResolvedValue(dbUser());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("sign-in", () => {
    it("sets id, authTime and lastActivityAt, and takes role from the database", async () => {
      mockUserFindUnique.mockResolvedValue(dbUser({ role: "ADMIN" }));

      const token = await runJwt({
        token: { sub: "user-42" },
        user: { id: "user-42", email: "u@ex.com", role: "USER" } as unknown as never,
        trigger: "signIn",
      });

      expect(token).toMatchObject({
        id: "user-42",
        role: "ADMIN",
        authTime: MOCKED_NOW,
        lastActivityAt: MOCKED_NOW,
      });
    });

    it("no longer writes token.exp (Auth.js overwrites it, research R1)", async () => {
      setTimeoutMinutes(60);

      const token = await runJwt({
        token: { sub: "user-1" },
        user: { id: "user-1", email: "u@ex.com", role: "USER" } as unknown as never,
        trigger: "signIn",
      });

      expect(token).not.toBeNull();
      expect((token as Record<string, unknown>).exp).toBeUndefined();
    });
  });

  describe("role and profile claims come from the database (FR-001)", () => {
    it("refreshes a stale USER role to ADMIN (promotion)", async () => {
      mockUserFindUnique.mockResolvedValue(dbUser({ role: "ADMIN" }));
      const token = await runJwt({ token: sessionToken({ role: "USER" }) });
      expect(token?.role).toBe("ADMIN");
    });

    it("refreshes a stale ADMIN role to USER (demotion without revocation marker)", async () => {
      mockUserFindUnique.mockResolvedValue(dbUser({ role: "USER" }));
      const token = await runJwt({ token: sessionToken({ role: "ADMIN" }) });
      expect(token?.role).toBe("USER");
    });

    it("refreshes useGravatar on every call", async () => {
      mockUserFindUnique.mockResolvedValue(dbUser({ useGravatar: true }));
      const token = await runJwt({ token: sessionToken({ useGravatar: false }) });
      expect(token?.useGravatar).toBe(true);
    });

    it("queries the user by primary key exactly once per call", async () => {
      await runJwt({ token: sessionToken() });
      expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
      expect(mockUserFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "user-1" } }),
      );
    });
  });

  describe("revocation returns null, never {} (FR-002, FR-006)", () => {
    it("returns null when the user was deleted", async () => {
      mockUserFindUnique.mockResolvedValue(null);
      expect(await runJwt({ token: sessionToken() })).toBeNull();
    });

    it.each(["SUSPENDED", "PENDING"])("returns null when status is %s", async (status) => {
      mockUserFindUnique.mockResolvedValue(dbUser({ status }));
      expect(await runJwt({ token: sessionToken() })).toBeNull();
    });

    it("keeps an old session invalid after reactivation (FR-005)", async () => {
      mockUserFindUnique.mockResolvedValue(
        dbUser({ status: "ACTIVE", sessionsRevokedAt: new Date(MOCKED_NOW - 5 * MINUTE) }),
      );
      const token = await runJwt({ token: sessionToken({ authTime: MOCKED_NOW - 60 * MINUTE }) });
      expect(token).toBeNull();
    });

    it("keeps a demoted-then-repromoted admin's old session invalid", async () => {
      mockUserFindUnique.mockResolvedValue(
        dbUser({ role: "ADMIN", sessionsRevokedAt: new Date(MOCKED_NOW - 5 * MINUTE) }),
      );
      const token = await runJwt({
        token: sessionToken({ role: "ADMIN", authTime: MOCKED_NOW - 60 * MINUTE }),
      });
      expect(token).toBeNull();
    });

    it("accepts a session created after the revocation", async () => {
      mockUserFindUnique.mockResolvedValue(
        dbUser({ sessionsRevokedAt: new Date(MOCKED_NOW - 5 * MINUTE) }),
      );
      const token = await runJwt({ token: sessionToken({ authTime: MOCKED_NOW - MINUTE }) });
      expect(token).not.toBeNull();
    });

    it("fails closed when the database lookup throws", async () => {
      mockUserFindUnique.mockRejectedValue(new Error("db down"));
      await expect(runJwt({ token: sessionToken() })).rejects.toThrow("db down");
    });
  });

  describe("password change invalidation (FR-007, FR-008)", () => {
    it("rejects a continuously refreshed session whose iat is newer than the change", async () => {
      mockUserFindUnique.mockResolvedValue(
        dbUser({ passwordChangedAt: new Date(MOCKED_NOW - 30_000) }),
      );
      const token = await runJwt({
        token: sessionToken({
          authTime: MOCKED_NOW - 10 * MINUTE,
          lastActivityAt: MOCKED_NOW - 1_000,
          iat: Math.floor(MOCKED_NOW / 1000), // refreshed just now: must NOT matter
        }),
      });
      expect(token).toBeNull();
    });

    it("accepts a session created after the password change", async () => {
      mockUserFindUnique.mockResolvedValue(
        dbUser({ passwordChangedAt: new Date(MOCKED_NOW - 30_000) }),
      );
      const token = await runJwt({ token: sessionToken({ authTime: MOCKED_NOW - 10_000 }) });
      expect(token).not.toBeNull();
    });

    it("accepts any session when passwordChangedAt is null", async () => {
      const token = await runJwt({ token: sessionToken({ authTime: MOCKED_NOW - 90 * 24 * 60 * MINUTE }) });
      expect(token).not.toBeNull();
    });

    it("does not rely on the removed 5-minute cache claims", async () => {
      const token = await runJwt({
        token: sessionToken({ pwdCheckedAt: 1, pwdChangedAt: 1 }),
      });
      expect(token).not.toHaveProperty("pwdCheckedAt");
      expect(token).not.toHaveProperty("pwdChangedAt");
      expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe("migration of tokens issued before the fix (FR-012)", () => {
    it("stamps authTime and lastActivityAt with now when they are missing", async () => {
      const token = await runJwt({ token: makeToken() });
      expect(token).toMatchObject({ authTime: MOCKED_NOW, lastActivityAt: MOCKED_NOW });
    });

    it("still applies status checks to legacy tokens", async () => {
      mockUserFindUnique.mockResolvedValue(dbUser({ status: "SUSPENDED" }));
      expect(await runJwt({ token: makeToken() })).toBeNull();
    });
  });

  describe("idle timeout and activity (FR-009, FR-010, FR-010a, FR-011)", () => {
    it("never expires from inactivity when the timeout is null", async () => {
      setTimeoutMinutes(null);
      const token = await runJwt({
        token: sessionToken({ lastActivityAt: MOCKED_NOW - 365 * 24 * 60 * MINUTE }),
      });
      expect(token).not.toBeNull();
    });

    it("returns null when idle longer than the configured timeout", async () => {
      setTimeoutMinutes(60);
      const token = await runJwt({
        token: sessionToken({ lastActivityAt: MOCKED_NOW - 61 * MINUTE }),
      });
      expect(token).toBeNull();
    });

    it("keeps a session that is within the timeout", async () => {
      setTimeoutMinutes(60);
      const token = await runJwt({
        token: sessionToken({ lastActivityAt: MOCKED_NOW - 59 * MINUTE }),
      });
      expect(token).not.toBeNull();
    });

    it("extends lastActivityAt only on update with activity: true", async () => {
      setTimeoutMinutes(60);
      const token = await runJwt({
        token: sessionToken({ lastActivityAt: MOCKED_NOW - 59 * MINUTE }),
        trigger: "update",
        session: { activity: true },
      });
      expect(token?.lastActivityAt).toBe(MOCKED_NOW);
    });

    it("does not extend lastActivityAt on update without activity (e.g. Gravatar)", async () => {
      const before = MOCKED_NOW - 30 * MINUTE;
      const token = await runJwt({
        token: sessionToken({ lastActivityAt: before }),
        trigger: "update",
        session: { useGravatar: true },
      });
      expect(token?.lastActivityAt).toBe(before);
    });

    it("does not extend lastActivityAt on plain background refetches", async () => {
      const before = MOCKED_NOW - 30 * MINUTE;
      const token = await runJwt({ token: sessionToken({ lastActivityAt: before }), trigger: undefined });
      expect(token?.lastActivityAt).toBe(before);
    });

    it("cannot resurrect an already expired session with an activity update", async () => {
      setTimeoutMinutes(60);
      const token = await runJwt({
        token: sessionToken({ lastActivityAt: MOCKED_NOW - 120 * MINUTE }),
        trigger: "update",
        session: { activity: true },
      });
      expect(token).toBeNull();
    });

    it("applies a newly shortened timeout to an existing session", async () => {
      const stale = sessionToken({ lastActivityAt: MOCKED_NOW - 2 * 60 * MINUTE });
      setTimeoutMinutes(1440);
      expect(await runJwt({ token: stale })).not.toBeNull();
      setTimeoutMinutes(60);
      expect(await runJwt({ token: stale })).toBeNull();
    });

    it("never lets an update payload change authTime or role", async () => {
      const token = await runJwt({
        token: sessionToken(),
        trigger: "update",
        session: { activity: true, authTime: 0, role: "ADMIN" },
      });
      expect(token?.authTime).toBe(MOCKED_NOW - MINUTE);
      expect(token?.role).toBe("USER");
    });
  });
});

describe("authorize callback — user status checks", () => {
  beforeAll(async () => {
    await import("@/lib/auth/auth");
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
