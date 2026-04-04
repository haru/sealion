/** @jest-environment node */
import { POST } from "@/app/api/auth/signup/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/auth-settings", () => ({
  getAuthSettings: jest.fn().mockResolvedValue({
    id: "singleton",
    allowUserSignup: true,
    sessionTimeoutMinutes: null,
    requireEmailVerification: false,
    updatedAt: new Date(),
  }),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed_password"),
}));

jest.mock("@/lib/email-verification", () => ({
  generateToken: jest.fn().mockReturnValue("mock-token-64charhex000000000000000000000000000000000"),
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

import { getAuthSettings } from "@/lib/auth-settings";
import { prisma } from "@/lib/db";
import { generateToken, sendVerificationEmail } from "@/lib/email-verification";

const mockGetAuthSettings = getAuthSettings as jest.Mock;
const mockFindUnique = prisma.user.findUnique as jest.Mock;
const mockCreate = prisma.user.create as jest.Mock;
const mockDelete = prisma.user.delete as jest.Mock;
const mockSendVerificationEmail = sendVerificationEmail as jest.Mock;

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthSettings.mockResolvedValue({
      id: "singleton",
      allowUserSignup: true,
      sessionTimeoutMinutes: null,
      requireEmailVerification: false,
      updatedAt: new Date(),
    });
  });

  it("returns 201 and user data on success", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "clxxx",
      email: "user@example.com",
      role: "USER",
    });

    const req = makeRequest({ email: "user@example.com", password: "password123", username: "Alice" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.email).toBe("user@example.com");
    expect(json.error).toBeNull();
  });

  it("returns 400 MISSING_USERNAME when username is not provided", async () => {
    const req = makeRequest({ email: "user@example.com", password: "password123" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("MISSING_USERNAME");
  });

  it("returns 400 MISSING_USERNAME when username is whitespace only", async () => {
    const req = makeRequest({ email: "user@example.com", password: "password123", username: "   " });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("MISSING_USERNAME");
  });

  it("passes username to user create when provided", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "clxxx",
      email: "user@example.com",
      role: "USER",
    });

    const req = makeRequest({ email: "user@example.com", password: "password123", username: "Alice" });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ username: "Alice" }) })
    );
  });

  it("returns 409 when email already exists", async () => {
    mockFindUnique.mockResolvedValue({ id: "existing", email: "user@example.com" });

    const req = makeRequest({ email: "user@example.com", password: "password123", username: "Alice" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("returns 400 when password is too short", async () => {
    const req = makeRequest({ email: "user@example.com", password: "short", username: "Alice" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBeTruthy();
  });

  it("returns 400 when email is invalid", async () => {
    const req = makeRequest({ email: "not-an-email", password: "password123", username: "Alice" });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 INVALID_INPUT when body is missing email field", async () => {
    const req = makeRequest({ password: "password123", username: "Alice" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_INPUT");
  });

  it("returns 400 INVALID_INPUT when body is missing password field", async () => {
    const req = makeRequest({ email: "user@example.com", username: "Alice" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_INPUT");
  });

  it("returns 403 SIGNUP_DISABLED when allowUserSignup is false", async () => {
    mockGetAuthSettings.mockResolvedValue({
      id: "singleton",
      allowUserSignup: false,
      sessionTimeoutMinutes: null,
      requireEmailVerification: false,
      updatedAt: new Date(),
    });

    const req = makeRequest({ email: "user@example.com", password: "password123", username: "Alice" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("SIGNUP_DISABLED");
  });

  it("proceeds normally when allowUserSignup is true", async () => {
    mockGetAuthSettings.mockResolvedValue({
      id: "singleton",
      allowUserSignup: true,
      sessionTimeoutMinutes: null,
      requireEmailVerification: false,
      updatedAt: new Date(),
    });
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "clyyyy", email: "user2@example.com", role: "USER" });

    const req = makeRequest({ email: "user2@example.com", password: "password123", username: "Bob" });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });

  it("creates user with status PENDING and sends verification email when requireEmailVerification is true", async () => {
    mockGetAuthSettings.mockResolvedValue({
      id: "singleton",
      allowUserSignup: true,
      sessionTimeoutMinutes: null,
      requireEmailVerification: true,
      updatedAt: new Date(),
    });
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "clzzz",
      email: "new@example.com",
      role: "USER",
    });

    const req = makeRequest({ email: "new@example.com", password: "password123", username: "Eve" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.verificationRequired).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PENDING",
          emailVerificationToken: expect.any(String),
          emailVerificationTokenExpires: expect.any(Date),
        }),
      })
    );
    expect(mockSendVerificationEmail).toHaveBeenCalledWith("new@example.com", expect.any(String));
  });

  it("creates user with status ACTIVE when requireEmailVerification is false", async () => {
    mockGetAuthSettings.mockResolvedValue({
      id: "singleton",
      allowUserSignup: true,
      sessionTimeoutMinutes: null,
      requireEmailVerification: false,
      updatedAt: new Date(),
    });
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "claaa",
      email: "old@example.com",
      role: "USER",
    });

    const req = makeRequest({ email: "old@example.com", password: "password123", username: "Frank" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.verificationRequired).toBeUndefined();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ACTIVE" }),
      })
    );
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();
  });

  it("returns 503 VERIFICATION_EMAIL_SEND_FAILED and rolls back user when sendVerificationEmail throws", async () => {
    mockGetAuthSettings.mockResolvedValue({
      id: "singleton",
      allowUserSignup: true,
      sessionTimeoutMinutes: null,
      requireEmailVerification: true,
      updatedAt: new Date(),
    });
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "clrollback",
      email: "rollback@example.com",
      role: "USER",
    });
    mockSendVerificationEmail.mockRejectedValue(new Error("SMTP connection refused"));
    mockDelete.mockResolvedValue({ id: "clrollback" });

    const req = makeRequest({ email: "rollback@example.com", password: "password123", username: "Grace" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.error).toBe("VERIFICATION_EMAIL_SEND_FAILED");
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "clrollback" } });
  });

  it("returns 503 VERIFICATION_EMAIL_SEND_FAILED even when rollback delete also fails", async () => {
    mockGetAuthSettings.mockResolvedValue({
      id: "singleton",
      allowUserSignup: true,
      sessionTimeoutMinutes: null,
      requireEmailVerification: true,
      updatedAt: new Date(),
    });
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "clrollback2",
      email: "rollback2@example.com",
      role: "USER",
    });
    mockSendVerificationEmail.mockRejectedValue(new Error("SMTP error"));
    mockDelete.mockRejectedValue(new Error("DB connection lost"));

    const req = makeRequest({ email: "rollback2@example.com", password: "password123", username: "Hank" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.error).toBe("VERIFICATION_EMAIL_SEND_FAILED");
  });
});
