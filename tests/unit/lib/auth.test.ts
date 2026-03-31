/** @jest-environment node */
/**
 * Unit tests for the jwt callback in src/lib/auth.ts.
 * Focuses on sessionTimeoutMinutes integration (T022).
 */

import type { NextAuthConfig } from "next-auth";

let capturedCallbacks: NextAuthConfig["callbacks"];

jest.mock("next-auth", () => ({
  __esModule: true,
  default: jest.fn((config: NextAuthConfig) => {
    capturedCallbacks = config.callbacks;
    return { handlers: {}, auth: jest.fn(), signIn: jest.fn(), signOut: jest.fn() };
  }),
}));

jest.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: jest.fn(() => ({})) }));
jest.mock("next-auth/providers/credentials", () => jest.fn(() => ({ id: "credentials" })));
jest.mock("@/lib/db", () => ({
  prisma: {
    authSettings: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

const mockAuthSettingsFindUnique = prisma.authSettings.findUnique as jest.Mock;



function makeToken(extra: Record<string, unknown> = {}) {
  return { sub: "user-1", id: "user-1", role: "USER", ...extra };
}

describe("jwt callback — sessionTimeoutMinutes", () => {
  const MOCKED_NOW = 1_700_000_000_000; // fixed timestamp

  beforeAll(async () => {
    // Import auth to trigger NextAuth mock and capture callbacks
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
    mockAuthSettingsFindUnique.mockResolvedValue({
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
    mockAuthSettingsFindUnique.mockResolvedValue({
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

    expect(mockAuthSettingsFindUnique).not.toHaveBeenCalled();
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

    expect(mockAuthSettingsFindUnique).not.toHaveBeenCalled();
  });

  it("sets token.id and token.role from user on signIn", async () => {
    mockAuthSettingsFindUnique.mockResolvedValue({
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
