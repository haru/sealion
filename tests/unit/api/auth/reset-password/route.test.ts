/** @jest-environment node */
import { POST } from "@/app/api/auth/reset-password/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/password-reset", () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  normalizeEmail: jest.fn((email: string) => email.trim().toLowerCase()),
  RateLimitedError: class RateLimitedError extends Error {
    constructor() { super("Rate limit exceeded"); this.name = "RateLimitedError"; }
  },
  SmtpNotConfiguredError: class SmtpNotConfiguredError extends Error {
    constructor() { super("SMTP not configured"); this.name = "SmtpNotConfiguredError"; }
  },
}));

import { sendPasswordResetEmail, normalizeEmail, RateLimitedError, SmtpNotConfiguredError } from "@/lib/password-reset";

const mockSendPasswordResetEmail = sendPasswordResetEmail as jest.Mock;
const mockNormalizeEmail = normalizeEmail as jest.Mock;

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNormalizeEmail.mockImplementation((email: string) => email.trim().toLowerCase());
  });

  it("returns 200 with success message for a valid registered email", async () => {
    const req = makeRequest({ email: "user@example.com" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.message).toBeTruthy();
    expect(json.error).toBeNull();
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith("user@example.com");
  });

  it("normalizes email before sending reset email", async () => {
    const req = makeRequest({ email: "  User@Example.COM  " });
    await POST(req);

    expect(mockNormalizeEmail).toHaveBeenCalledWith("  User@Example.COM  ");
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith("user@example.com");
  });

  it("returns 200 with same message for an unregistered email (account enumeration prevention)", async () => {
    mockSendPasswordResetEmail.mockRejectedValue(
      Object.assign(new Error("User not found"), { code: "USER_NOT_FOUND" }),
    );

    const req = makeRequest({ email: "nobody@example.com" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.message).toBeTruthy();
  });

  it("returns 400 when email is missing", async () => {
    const req = makeRequest({});
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_EMAIL");
  });

  it("returns 400 for invalid email format", async () => {
    const req = makeRequest({ email: "not-an-email" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_EMAIL");
  });

  it("returns 429 when rate limited", async () => {
    mockSendPasswordResetEmail.mockRejectedValue(new RateLimitedError());

    const req = makeRequest({ email: "user@example.com" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(429);
    expect(json.error).toBe("RATE_LIMITED");
  });

  it("returns 500 when SMTP is not configured", async () => {
    mockSendPasswordResetEmail.mockRejectedValue(new SmtpNotConfiguredError());

    const req = makeRequest({ email: "user@example.com" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("INTERNAL_ERROR");
  });
});
