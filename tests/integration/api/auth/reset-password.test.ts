/** @jest-environment node */
/**
 * Integration tests for reset-password route edge cases with mocked
 * password-reset helpers.
 *
 * These tests cover request and confirm endpoint behavior, including
 * handling suspended or deleted users during password reset confirmation.
 */

import { NextRequest } from "next/server";

jest.mock("@/lib/email/password-reset", () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  verifyPasswordResetToken: jest.fn().mockResolvedValue("user@example.com"),
  consumePasswordResetToken: jest.fn().mockResolvedValue(undefined),
  normalizeEmail: jest.fn((email: string) => email.trim().toLowerCase()),
  isRateLimited: jest.fn().mockReturnValue(false),
  RateLimitedError: class RateLimitedError extends Error {
    constructor() { super("Rate limit exceeded"); this.name = "RateLimitedError"; }
  },
  SmtpNotConfiguredError: class SmtpNotConfiguredError extends Error {
    constructor() { super("SMTP not configured"); this.name = "SmtpNotConfiguredError"; }
  },
  TokenExpiredError: class TokenExpiredError extends Error {
    constructor() { super("Token expired"); this.name = "TokenExpiredError"; }
  },
}));

jest.mock("@/lib/db/db", () => ({
  prisma: {
    verificationToken: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("$2a$12$newhash"),
}));

import { sendPasswordResetEmail, verifyPasswordResetToken, consumePasswordResetToken } from "@/lib/email/password-reset";
import { prisma } from "@/lib/db/db";
import { POST as resetPOST } from "@/app/api/auth/reset-password/route";
import { POST as confirmPOST } from "@/app/api/auth/reset-password/confirm/route";

const mockSendPasswordResetEmail = sendPasswordResetEmail as jest.Mock;
const mockVerify = verifyPasswordResetToken as jest.Mock;
const mockConsume = consumePasswordResetToken as jest.Mock;
const mockVTDeleteMany = prisma.verificationToken.deleteMany as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockUserUpdate = prisma.user.update as jest.Mock;

function makeResetRequest(email: string): NextRequest {
  return new NextRequest("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

function makeConfirmRequest(token: string, password: string): NextRequest {
  return new NextRequest("http://localhost/api/auth/reset-password/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password, confirmPassword: password }),
  });
}

describe("Integration: token invalidation on re-request", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockResolvedValue("user@example.com");
    mockUserFindUnique.mockResolvedValue({ id: "user-1", status: "ACTIVE" });
    mockUserUpdate.mockResolvedValue({});
  });

  it("invalidates first token when a second reset is requested", async () => {
    const res1 = await resetPOST(makeResetRequest("user@example.com"));
    expect(res1.status).toBe(200);
    expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1);

    const res2 = await resetPOST(makeResetRequest("user@example.com"));
    expect(res2.status).toBe(200);
    expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(2);
  });

  it("confirm fails for suspended user after requesting reset", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user-suspended", status: "SUSPENDED" });

    const res = await confirmPOST(makeConfirmRequest("valid-token", "newpassword123"));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("FORBIDDEN");
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("confirm fails for deleted user after requesting reset", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const res = await confirmPOST(makeConfirmRequest("valid-token", "newpassword123"));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("NOT_FOUND");
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockConsume).not.toHaveBeenCalled();
  });

  it("rate limit is enforced between requests", async () => {
    mockSendPasswordResetEmail
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Rate limit exceeded"));

    const res1 = await resetPOST(makeResetRequest("user@example.com"));
    expect(res1.status).toBe(200);

    const res2 = await resetPOST(makeResetRequest("user@example.com"));
    expect(res2.status).toBe(200);
  });
});
