/** @jest-environment node */

jest.mock("@/lib/db/db", () => ({
  prisma: {
    verificationToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: "user-1", status: "ACTIVE" }),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/email/smtp-mailer", () => ({
  sendMail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/email/smtp-settings", () => ({
  getSmtpSettings: jest.fn().mockResolvedValue({
    id: "singleton",
    host: "smtp.example.com",
    port: 587,
    fromAddress: "no-reply@example.com",
    fromName: "Sealion",
    requireAuth: false,
    username: null,
    encryptedPassword: null,
    useTls: false,
    updatedAt: new Date(),
  }),
}));

jest.mock("@/lib/email/email-verification", () => ({
  generateToken: jest.fn().mockReturnValue("a".repeat(64)),
  getAppBaseUrl: jest.fn().mockReturnValue("http://localhost:3000"),
}));

import { prisma } from "@/lib/db/db";
import { sendMail } from "@/lib/email/smtp-mailer";
import { getSmtpSettings } from "@/lib/email/smtp-settings";
import {
  sendPasswordResetEmail,
  verifyPasswordResetToken,
  consumePasswordResetToken,
  isRateLimited,
  normalizeEmail,
  TokenExpiredError,
} from "@/lib/email/password-reset";

const mockVTCreate = prisma.verificationToken.create as jest.Mock;
const mockVTFindUnique = prisma.verificationToken.findUnique as jest.Mock;
const mockVTDeleteMany = prisma.verificationToken.deleteMany as jest.Mock;
const mockSendMail = sendMail as jest.Mock;
const mockGetSmtpSettings = getSmtpSettings as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUserFindUnique.mockResolvedValue({ id: "user-1", status: "ACTIVE" });
  mockGetSmtpSettings.mockResolvedValue({
    id: "singleton",
    host: "smtp.example.com",
    port: 587,
    fromAddress: "no-reply@example.com",
    fromName: "Sealion",
    requireAuth: false,
    username: null,
    encryptedPassword: null,
    useTls: false,
    updatedAt: new Date(),
  });
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-01-15T12:00:00Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

describe("normalizeEmail", () => {
  it("trims whitespace and lowercases the email", () => {
    expect(normalizeEmail("  User@Example.COM  ")).toBe("user@example.com");
  });

  it("returns the same string when already normalized", () => {
    expect(normalizeEmail("user@example.com")).toBe("user@example.com");
  });
});

describe("sendPasswordResetEmail", () => {
  it("creates a VerificationToken with normalized email identifier and 24h expiry, then sends mail", async () => {
    mockVTCreate.mockResolvedValue({});
    mockVTDeleteMany.mockResolvedValue({ count: 0 });

    await sendPasswordResetEmail("User@Example.COM");

    expect(mockVTDeleteMany).toHaveBeenCalledWith({
      where: { identifier: "password-reset:user@example.com" },
    });
    expect(mockVTCreate).toHaveBeenCalledWith({
      data: {
        identifier: "password-reset:user@example.com",
        token: expect.any(String),
        expires: new Date("2026-01-16T12:00:00.000Z"),
      },
    });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: expect.stringContaining("password"),
      }),
    );
  });

  it("throws descriptive error when SMTP is not configured", async () => {
    mockGetSmtpSettings.mockResolvedValue(null);

    await expect(sendPasswordResetEmail("smtp-fail@example.com")).rejects.toThrow("SMTP not configured");
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("throws RateLimitedError when rate limit is exceeded", async () => {
    isRateLimited("rate@example.com");

    await expect(sendPasswordResetEmail("rate@example.com")).rejects.toThrow("Rate limit exceeded");
  });

  it("returns silently when user does not exist (prevents enumeration)", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    await sendPasswordResetEmail("nonexistent@example.com");

    expect(mockVTCreate).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("returns silently when user is suspended", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user-1", status: "SUSPENDED" });

    await sendPasswordResetEmail("suspended@example.com");

    expect(mockVTCreate).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("returns silently when user is pending", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user-1", status: "PENDING" });

    await sendPasswordResetEmail("pending@example.com");

    expect(mockVTCreate).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});

describe("verifyPasswordResetToken", () => {
  it("returns the email for a valid non-expired token", async () => {
    mockVTFindUnique.mockResolvedValue({
      identifier: "password-reset:user@example.com",
      token: "abc",
      expires: new Date("2026-01-16T12:00:00.000Z"),
    });

    const result = await verifyPasswordResetToken("abc");

    expect(result).toBe("user@example.com");
    expect(mockVTFindUnique).toHaveBeenCalledWith({
      where: { token: "abc" },
    });
  });

  it("returns null for a missing token", async () => {
    mockVTFindUnique.mockResolvedValue(null);

    const result = await verifyPasswordResetToken("nonexistent");

    expect(result).toBeNull();
  });

  it("throws TokenExpiredError for an expired token", async () => {
    mockVTFindUnique.mockResolvedValue({
      identifier: "password-reset:user@example.com",
      token: "abc",
      expires: new Date("2026-01-14T12:00:00.000Z"),
    });

    await expect(verifyPasswordResetToken("abc")).rejects.toThrow(TokenExpiredError);
  });
});

describe("consumePasswordResetToken", () => {
  it("deletes the token idempotently using deleteMany", async () => {
    mockVTDeleteMany.mockResolvedValue({ count: 1 });

    await consumePasswordResetToken("abc");

    expect(mockVTDeleteMany).toHaveBeenCalledWith({
      where: { token: "abc" },
    });
  });

  it("does not throw when token does not exist (idempotent)", async () => {
    mockVTDeleteMany.mockResolvedValue({ count: 0 });

    await expect(consumePasswordResetToken("nonexistent")).resolves.toBeUndefined();
    expect(mockVTDeleteMany).toHaveBeenCalledWith({
      where: { token: "nonexistent" },
    });
  });
});

describe("isRateLimited", () => {
  it("returns false on the first request for an email", () => {
    const result = isRateLimited("fresh@example.com");

    expect(result).toBe(false);
  });

  it("returns true on a second request within 60 seconds", () => {
    isRateLimited("quick@example.com");

    const result = isRateLimited("quick@example.com");

    expect(result).toBe(true);
  });

  it("returns false after 60 seconds have elapsed", () => {
    isRateLimited("wait@example.com");

    const blocked = isRateLimited("wait@example.com");
    expect(blocked).toBe(true);

    jest.advanceTimersByTime(61_000);

    const allowed = isRateLimited("wait@example.com");
    expect(allowed).toBe(false);
  });

  it("uses separate counters per email address", () => {
    isRateLimited("user1@example.com");
    isRateLimited("user2@example.com");

    const blocked1 = isRateLimited("user1@example.com");
    expect(blocked1).toBe(true);

    const blocked2 = isRateLimited("user2@example.com");
    expect(blocked2).toBe(true);
  });
});
