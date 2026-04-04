/** @jest-environment node */
/**
 * Unit tests for the email-verification utility module.
 * Covers token generation, email sending, and token verification.
 */

jest.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/smtp-settings", () => ({
  getSmtpSettings: jest.fn(),
}));

jest.mock("@/lib/smtp-mailer", () => ({
  sendMail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/encryption", () => ({
  decrypt: jest.fn(),
}));

import { prisma } from "@/lib/db";
import { getSmtpSettings } from "@/lib/smtp-settings";
import { sendMail } from "@/lib/smtp-mailer";
import { decrypt } from "@/lib/encryption";
import {
  generateToken,
  getAppBaseUrl,
  sendVerificationEmail,
  verifyToken,
  TokenExpiredError,
} from "@/lib/email-verification";

const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockUserUpdate = prisma.user.update as jest.Mock;
const mockGetSmtpSettings = getSmtpSettings as jest.Mock;
const mockSendMail = sendMail as jest.Mock;
const mockDecrypt = decrypt as jest.Mock;

describe("getAppBaseUrl", () => {
  const ORIGINAL_AUTH_URL = process.env.AUTH_URL;
  const ORIGINAL_NEXTAUTH_URL = process.env.NEXTAUTH_URL;

  afterEach(() => {
    process.env.AUTH_URL = ORIGINAL_AUTH_URL;
    process.env.NEXTAUTH_URL = ORIGINAL_NEXTAUTH_URL;
  });

  it("returns AUTH_URL when set", () => {
    process.env.AUTH_URL = "https://auth.example.com";
    process.env.NEXTAUTH_URL = "https://next.example.com";
    expect(getAppBaseUrl()).toBe("https://auth.example.com");
  });

  it("falls back to NEXTAUTH_URL when AUTH_URL is not set", () => {
    delete process.env.AUTH_URL;
    process.env.NEXTAUTH_URL = "https://next.example.com";
    expect(getAppBaseUrl()).toBe("https://next.example.com");
  });

  it("falls back to http://localhost:3000 when neither env var is set", () => {
    delete process.env.AUTH_URL;
    delete process.env.NEXTAUTH_URL;
    expect(getAppBaseUrl()).toBe("http://localhost:3000");
  });
});

describe("generateToken", () => {
  it("returns a 64-character hex string", () => {
    const token = generateToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns unique values on successive calls", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });
});

describe("sendVerificationEmail", () => {
  const ORIGINAL_AUTH_URL = process.env.AUTH_URL;
  const ORIGINAL_NEXTAUTH_URL = process.env.NEXTAUTH_URL;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env.AUTH_URL = ORIGINAL_AUTH_URL;
    process.env.NEXTAUTH_URL = ORIGINAL_NEXTAUTH_URL;
  });

  it("sends verification email with correct params when SMTP is configured", async () => {
    process.env.AUTH_URL = "https://example.com";
    mockGetSmtpSettings.mockResolvedValue({
      host: "smtp.example.com",
      port: 587,
      fromAddress: "noreply@example.com",
      fromName: "Sealion",
      requireAuth: false,
      username: null,
      encryptedPassword: null,
      useTls: false,
    });

    await sendVerificationEmail("user@example.com", "abc123");

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe("user@example.com");
    expect(call.host).toBe("smtp.example.com");
    expect(call.fromAddress).toBe("noreply@example.com");
    expect(call.fromName).toBe("Sealion");
    expect(call.text).toContain("abc123");
    expect(call.text).toContain("https://example.com/api/auth/confirm?token=abc123");
  });

  it("falls back to NEXTAUTH_URL when AUTH_URL is not set", async () => {
    delete process.env.AUTH_URL;
    process.env.NEXTAUTH_URL = "https://fallback.com";
    mockGetSmtpSettings.mockResolvedValue({
      host: "smtp.example.com",
      port: 587,
      fromAddress: "noreply@example.com",
      fromName: "Sealion",
      requireAuth: false,
      username: null,
      encryptedPassword: null,
      useTls: false,
    });

    await sendVerificationEmail("user@example.com", "token456");

    const call = mockSendMail.mock.calls[0][0];
    expect(call.text).toContain("https://fallback.com/api/auth/confirm?token=token456");
  });

  it("does not throw and warns when SMTP is not configured", async () => {
    process.env.AUTH_URL = "https://example.com";
    mockGetSmtpSettings.mockResolvedValue(null);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await expect(sendVerificationEmail("user@example.com", "token789")).resolves.toBeUndefined();

    expect(mockSendMail).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("SMTP"));

    warnSpy.mockRestore();
  });

  it("passes null password to sendMail when encryptedPassword is null", async () => {
    process.env.AUTH_URL = "https://example.com";
    mockGetSmtpSettings.mockResolvedValue({
      host: "smtp.example.com",
      port: 587,
      fromAddress: "noreply@example.com",
      fromName: "Sealion",
      requireAuth: false,
      username: null,
      encryptedPassword: null,
      useTls: false,
    });

    await sendVerificationEmail("user@example.com", "tokenXYZ");

    const call = mockSendMail.mock.calls[0][0];
    expect(call.password).toBeNull();
  });

  it("decrypts and passes password to sendMail when encryptedPassword is set", async () => {
    process.env.AUTH_URL = "https://example.com";
    mockGetSmtpSettings.mockResolvedValue({
      host: "smtp.example.com",
      port: 587,
      fromAddress: "noreply@example.com",
      fromName: "Sealion",
      requireAuth: true,
      username: "smtp-user",
      encryptedPassword: "encrypted-secret",
      useTls: true,
    });
    mockDecrypt.mockResolvedValue("decrypted-password");

    await sendVerificationEmail("user@example.com", "tokenABC");

    const call = mockSendMail.mock.calls[0][0];
    expect(call.password).toBe("decrypted-password");
  });
});

describe("verifyToken", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns user data for a valid non-expired token", async () => {
    const futureExpiry = new Date(Date.now() + 60_000);
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      status: "PENDING",
      emailVerificationToken: "valid-token",
      emailVerificationTokenExpires: futureExpiry,
    });

    const result = await verifyToken("valid-token");

    expect(result).toEqual({ id: "user-1", email: "user@example.com", status: "PENDING" });
  });

  it("returns null when no user is found for the token", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const result = await verifyToken("nonexistent");

    expect(result).toBeNull();
  });

  it("throws TokenExpiredError when token is expired", async () => {
    const pastExpiry = new Date(Date.now() - 60_000);
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      status: "PENDING",
      emailVerificationToken: "expired-token",
      emailVerificationTokenExpires: pastExpiry,
    });

    await expect(verifyToken("expired-token")).rejects.toThrow(TokenExpiredError);
  });

  it("returns null when token is empty/missing", async () => {
    const result = await verifyToken("");
    expect(result).toBeNull();
  });

  it("returns null when user has token but emailVerificationTokenExpires is null", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user-3",
      email: "user@example.com",
      status: "PENDING",
      emailVerificationToken: "some-token",
      emailVerificationTokenExpires: null,
    });

    const result = await verifyToken("some-token");
    expect(result).toBeNull();
  });

  it("returns status as a valid UserStatus enum value", async () => {
    const futureExpiry = new Date(Date.now() + 60_000);
    mockUserFindUnique.mockResolvedValue({
      id: "user-2",
      email: "pending@example.com",
      status: "PENDING",
      emailVerificationToken: "some-token",
      emailVerificationTokenExpires: futureExpiry,
    });

    const result = await verifyToken("some-token");

    expect(result).not.toBeNull();
    // status must be one of the valid UserStatus values
    expect(["PENDING", "ACTIVE", "SUSPENDED"]).toContain(result!.status);
  });
});
