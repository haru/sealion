/** @jest-environment node */
/**
 * Unit tests for `handleExternalSignIn`.
 * Covers the five flows from contracts/auth-callback-flow.md: existing-user link,
 * new-user create when signup allowed, signup-disabled reject, email-not-verified
 * reject, and no-email reject.
 */

jest.mock("@/lib/db/db", () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn() },
    account: { findUnique: jest.fn(), create: jest.fn() },
    authProvider: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/auth/auth-settings", () => ({
  getAuthSettings: jest.fn(),
}));

import { prisma } from "@/lib/db/db";
import { getAuthSettings } from "@/lib/auth/auth-settings";
import { handleExternalSignIn } from "@/services/auth-provider/account-linking";

const mockUserFind = prisma.user.findUnique as jest.Mock;
const mockUserCreate = prisma.user.create as jest.Mock;
const mockAccountFind = prisma.account.findUnique as jest.Mock;
const mockAccountCreate = prisma.account.create as jest.Mock;
const mockGetSettings = getAuthSettings as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaTransaction = (prisma as any).$transaction as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // Run the transaction callback with the same mock prisma client as tx.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockPrismaTransaction.mockImplementation(async (fn: any) => fn(prisma));
});

function googleAccount(overrides: Record<string, unknown> = {}) {
  return {
    provider: "google",
    providerAccountId: "google-sub-123",
    type: "oidc" as const,
    access_token: "at",
    id_token: "idt",
    ...overrides,
  };
}

describe("handleExternalSignIn — credentials passthrough", () => {
  it("returns true unchanged for credentials account", async () => {
    const result = await handleExternalSignIn({
      user: { id: "u1", email: "x@y.z" },
      account: { provider: "credentials", providerAccountId: "x", type: "credentials" },
      profile: undefined,
    });
    expect(result).toBe(true);
    expect(mockUserFind).not.toHaveBeenCalled();
  });
});

describe("handleExternalSignIn — email checks", () => {
  it("rejects when no email present", async () => {
    const result = await handleExternalSignIn({
      user: { id: "tmp", email: null },
      account: googleAccount(),
      profile: { email_verified: true },
    });
    expect(result).toBe("/login?error=NO_EMAIL_FROM_PROVIDER");
  });

  it("rejects when email is not verified and requireEmailVerification is false", async () => {
    mockGetSettings.mockResolvedValue({
      allowUserSignup: true,
      requireEmailVerification: false,
      sessionTimeoutMinutes: null,
    });
    const result = await handleExternalSignIn({
      user: { id: "tmp", email: "alice@example.com" },
      account: googleAccount(),
      profile: { email: "alice@example.com", email_verified: false },
    });
    expect(result).toBe("/login?error=EMAIL_NOT_VERIFIED");
  });
});

describe("handleExternalSignIn — existing user link", () => {
  it("creates an Account for an existing user when not already linked", async () => {
    mockUserFind.mockResolvedValue({ id: "user_1", email: "alice@example.com" });
    mockAccountFind.mockResolvedValue(null);

    const result = await handleExternalSignIn({
      user: { id: "tmp", email: "alice@example.com" },
      account: googleAccount(),
      profile: { email: "alice@example.com", email_verified: true, name: "Alice" },
    });

    expect(result).toBe(true);
    expect(mockAccountCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: "google",
          providerAccountId: "google-sub-123",
          userId: "user_1",
        }),
      }),
    );
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it("does not create a duplicate Account when one already exists", async () => {
    mockUserFind.mockResolvedValue({ id: "user_1", email: "alice@example.com" });
    mockAccountFind.mockResolvedValue({ id: "acc_existing", userId: "user_1" });

    const result = await handleExternalSignIn({
      user: { id: "tmp", email: "alice@example.com" },
      account: googleAccount(),
      profile: { email: "alice@example.com", email_verified: true },
    });

    expect(result).toBe(true);
    expect(mockAccountCreate).not.toHaveBeenCalled();
  });

  it("normalises email to lowercase", async () => {
    mockUserFind.mockResolvedValue({ id: "user_1", email: "alice@example.com" });
    mockAccountFind.mockResolvedValue(null);

    await handleExternalSignIn({
      user: { id: "tmp", email: "Alice@Example.com" },
      account: googleAccount(),
      profile: { email: "Alice@Example.com", email_verified: true },
    });

    expect(mockUserFind).toHaveBeenCalledWith({
      where: { email: "alice@example.com" },
    });
  });
});

describe("handleExternalSignIn — new user creation", () => {
  it("creates an ACTIVE user when allowUserSignup=true and email verified", async () => {
    mockUserFind.mockResolvedValue(null);
    mockGetSettings.mockResolvedValue({
      allowUserSignup: true,
      requireEmailVerification: false,
      sessionTimeoutMinutes: null,
    });
    mockUserCreate.mockResolvedValue({ id: "new_user_1" });

    const result = await handleExternalSignIn({
      user: { id: "tmp", email: "bob@example.com", name: "Bob" },
      account: googleAccount(),
      profile: { email: "bob@example.com", email_verified: true, name: "Bob" },
    });

    expect(result).toBe(true);
    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "bob@example.com",
          passwordHash: null,
          status: "ACTIVE",
        }),
      }),
    );
    expect(mockAccountCreate).toHaveBeenCalled();
  });

  it("rejects sign-in for unverified IdP email even when requireEmailVerification is true", async () => {
    mockUserFind.mockResolvedValue(null);
    mockGetSettings.mockResolvedValue({
      allowUserSignup: true,
      requireEmailVerification: true,
      sessionTimeoutMinutes: null,
    });

    const result = await handleExternalSignIn({
      user: { id: "tmp", email: "carol@example.com" },
      account: googleAccount(),
      profile: { email: "carol@example.com", email_verified: false },
    });

    // An unverified IdP email must always be rejected regardless of the
    // requireEmailVerification setting — we never create PENDING users via
    // external IdPs because there is no local verification flow to complete.
    expect(result).toBe("/login?error=EMAIL_NOT_VERIFIED");
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it("wraps User and Account creation in a single transaction", async () => {
    mockUserFind.mockResolvedValue(null);
    mockGetSettings.mockResolvedValue({
      allowUserSignup: true,
      requireEmailVerification: false,
      sessionTimeoutMinutes: null,
    });
    mockUserCreate.mockResolvedValue({ id: "tx_user_1" });

    await handleExternalSignIn({
      user: { id: "tmp", email: "eve@example.com" },
      account: googleAccount(),
      profile: { email: "eve@example.com", email_verified: true },
    });

    // User and Account must be created atomically so a failed Account insert
    // cannot leave an orphaned User row.
    expect(mockPrismaTransaction).toHaveBeenCalled();
    expect(mockUserCreate).toHaveBeenCalled();
    expect(mockAccountCreate).toHaveBeenCalled();
  });

  it("rejects SIGNUP_DISABLED when no existing user and allowUserSignup=false", async () => {
    mockUserFind.mockResolvedValue(null);
    mockGetSettings.mockResolvedValue({
      allowUserSignup: false,
      requireEmailVerification: false,
      sessionTimeoutMinutes: null,
    });

    const result = await handleExternalSignIn({
      user: { id: "tmp", email: "dave@example.com" },
      account: googleAccount(),
      profile: { email: "dave@example.com", email_verified: true },
    });

    expect(result).toBe("/login?error=SIGNUP_DISABLED");
    expect(mockUserCreate).not.toHaveBeenCalled();
  });
});
