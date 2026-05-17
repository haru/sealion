/** @jest-environment node */
/**
 * Unit tests for GitHub-specific email handling in `handleExternalSignIn`.
 * Covers the `resolveGithubVerifiedEmail` helper (T042): verified primary email
 * returned from `/user/emails`, and the fallback when no verified email exists.
 */

const mockAxiosGet = jest.fn();

jest.mock("@/lib/db/db", () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn() },
    account: { findUnique: jest.fn(), create: jest.fn() },
  },
}));

jest.mock("@/lib/auth/auth-settings", () => ({
  getAuthSettings: jest.fn().mockResolvedValue({
    allowUserSignup: true,
    requireEmailVerification: false,
    sessionTimeoutMinutes: null,
  }),
}));

jest.mock("axios", () => {
  const actual = jest.requireActual<typeof import("axios")>("axios");
  return {
    ...actual,
    __esModule: true,
    default: { ...actual.default, get: (...args: unknown[]) => mockAxiosGet(...args) },
    get: (...args: unknown[]) => mockAxiosGet(...args),
  };
});

import { prisma } from "@/lib/db/db";
import { getAuthSettings } from "@/lib/auth/auth-settings";
import { resolveGithubVerifiedEmail } from "@/services/auth-provider/account-linking";
import { handleExternalSignIn } from "@/services/auth-provider/account-linking";

const mockUserFind = prisma.user.findUnique as jest.Mock;
const mockUserCreate = prisma.user.create as jest.Mock;
const mockAccountFind = prisma.account.findUnique as jest.Mock;
const mockAccountCreate = prisma.account.create as jest.Mock;
const mockGetSettings = getAuthSettings as jest.Mock;

function githubAccount(overrides: Record<string, unknown> = {}) {
  return {
    provider: "github",
    providerAccountId: "gh-sub-123",
    type: "oauth" as const,
    access_token: "gh-access-token",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSettings.mockResolvedValue({
    allowUserSignup: true,
    requireEmailVerification: false,
    sessionTimeoutMinutes: null,
  });
});

describe("resolveGithubVerifiedEmail", () => {
  it("returns true when GitHub API returns a verified primary email matching expected", async () => {
    mockAxiosGet.mockResolvedValue({
      data: [
        { email: "other@example.com", primary: false, verified: true },
        { email: "alice@github.com", primary: true, verified: true },
      ],
    });

    const result = await resolveGithubVerifiedEmail("tok", "alice@github.com");
    expect(result).toBe(true);
    expect(mockAxiosGet).toHaveBeenCalledWith(
      "https://api.github.com/user/emails",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer tok" }),
      }),
    );
  });

  it("returns false when no entry is both primary and verified", async () => {
    mockAxiosGet.mockResolvedValue({
      data: [
        { email: "alice@github.com", primary: true, verified: false },
        { email: "other@example.com", primary: false, verified: true },
      ],
    });

    const result = await resolveGithubVerifiedEmail("tok", "alice@github.com");
    expect(result).toBe(false);
  });

  it("returns false when the API call fails", async () => {
    mockAxiosGet.mockRejectedValue(new Error("Network error"));

    const result = await resolveGithubVerifiedEmail("tok", "alice@github.com");
    expect(result).toBe(false);
  });

  it("returns false when no emails match the expected address", async () => {
    mockAxiosGet.mockResolvedValue({
      data: [
        { email: "wrong@example.com", primary: true, verified: true },
      ],
    });

    const result = await resolveGithubVerifiedEmail("tok", "alice@github.com");
    expect(result).toBe(false);
  });
});

describe("handleExternalSignIn — GitHub email resolution", () => {
  it("calls GitHub /user/emails when profile lacks email_verified", async () => {
    mockUserFind.mockResolvedValue({ id: "user_1", email: "alice@github.com" });
    mockAccountFind.mockResolvedValue(null);
    mockAccountCreate.mockResolvedValue({ id: "acc_1" });
    mockAxiosGet.mockResolvedValue({
      data: [{ email: "alice@github.com", primary: true, verified: true }],
    });

    const result = await handleExternalSignIn({
      user: { id: "tmp", email: "alice@github.com" },
      account: githubAccount(),
      profile: { email: "alice@github.com", login: "alice" },
    });

    expect(result).toBe(true);
    expect(mockAxiosGet).toHaveBeenCalledWith(
      "https://api.github.com/user/emails",
      expect.any(Object),
    );
  });

  it("rejects EMAIL_NOT_VERIFIED when /user/emails returns no verified primary", async () => {
    mockUserFind.mockResolvedValue(null);
    mockAxiosGet.mockResolvedValue({
      data: [{ email: "alice@github.com", primary: true, verified: false }],
    });

    const result = await handleExternalSignIn({
      user: { id: "tmp", email: "alice@github.com" },
      account: githubAccount(),
      profile: { email: "alice@github.com", login: "alice" },
    });

    expect(result).toBe("/login?error=EMAIL_NOT_VERIFIED");
  });

  it("allows sign-in without calling /user/emails when profile has email_verified=true", async () => {
    mockUserFind.mockResolvedValue({ id: "user_1", email: "alice@github.com" });
    mockAccountFind.mockResolvedValue(null);
    mockAccountCreate.mockResolvedValue({ id: "acc_1" });

    const result = await handleExternalSignIn({
      user: { id: "tmp", email: "alice@github.com" },
      account: githubAccount(),
      profile: { email: "alice@github.com", email_verified: true, login: "alice" },
    });

    expect(result).toBe(true);
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });

  it("links to existing user when GitHub email is verified via API", async () => {
    mockUserFind.mockResolvedValue({ id: "user_1", email: "bob@github.com" });
    mockAccountFind.mockResolvedValue(null);
    mockAccountCreate.mockResolvedValue({ id: "acc_1" });
    mockAxiosGet.mockResolvedValue({
      data: [{ email: "bob@github.com", primary: true, verified: true }],
    });

    const result = await handleExternalSignIn({
      user: { id: "tmp", email: "bob@github.com" },
      account: githubAccount(),
      profile: { email: "bob@github.com", name: "Bob" },
    });

    expect(result).toBe(true);
    expect(mockAccountCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: "github",
          userId: "user_1",
        }),
      }),
    );
  });
});
