/** @jest-environment node */
import { POST } from "@/app/api/auth/reset-password/confirm/route";
import { NextRequest } from "next/server";

jest.mock("@/lib/password-reset", () => ({
  verifyPasswordResetToken: jest.fn().mockResolvedValue("user@example.com"),
  consumePasswordResetToken: jest.fn().mockResolvedValue(undefined),
  TokenExpiredError: class TokenExpiredError extends Error {
    constructor() { super("Token expired"); this.name = "TokenExpiredError"; }
  },
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("$2a$12$newhash"),
}));

import { verifyPasswordResetToken, consumePasswordResetToken, TokenExpiredError } from "@/lib/password-reset";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

const mockVerify = verifyPasswordResetToken as jest.Mock;
const mockConsume = consumePasswordResetToken as jest.Mock;
const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockUserUpdate = prisma.user.update as jest.Mock;
const mockHash = bcrypt.hash as jest.Mock;

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/auth/reset-password/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ACTIVE_USER = {
  id: "user-1",
  status: "ACTIVE",
};

describe("POST /api/auth/reset-password/confirm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockResolvedValue("user@example.com");
    mockUserFindUnique.mockResolvedValue(ACTIVE_USER);
    mockUserUpdate.mockResolvedValue({ ...ACTIVE_USER, passwordChangedAt: new Date() });
  });

  it("returns 200 and updates password on success", async () => {
    const req = makeRequest({
      token: "a".repeat(64),
      password: "newpassword123",
      confirmPassword: "newpassword123",
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.message).toBeTruthy();
    expect(json.error).toBeNull();
    expect(mockHash).toHaveBeenCalledWith("newpassword123", 12);
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          passwordChangedAt: expect.any(Date),
        }),
      }),
    );
    expect(mockConsume).toHaveBeenCalledWith("a".repeat(64));
  });

  it("returns 400 when token is missing", async () => {
    const req = makeRequest({ password: "newpassword123", confirmPassword: "newpassword123" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("MISSING_TOKEN");
  });

  it("returns 400 when password is too short", async () => {
    const req = makeRequest({ token: "tok", password: "short", confirmPassword: "short" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("PASSWORD_TOO_SHORT");
  });

  it("returns 400 when password is too long", async () => {
    const longPwd = "a".repeat(73);
    const req = makeRequest({ token: "tok", password: longPwd, confirmPassword: longPwd });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("PASSWORD_TOO_LONG");
  });

  it("returns 400 when passwords do not match", async () => {
    const req = makeRequest({ token: "tok", password: "password123", confirmPassword: "different" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("PASSWORD_MISMATCH");
  });

  it("returns 410 when token is expired", async () => {
    mockVerify.mockRejectedValue(new TokenExpiredError());

    const req = makeRequest({
      token: "expired-token",
      password: "newpassword123",
      confirmPassword: "newpassword123",
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(410);
    expect(json.error).toBe("EXPIRED_TOKEN");
  });

  it("returns 410 when token is invalid", async () => {
    mockVerify.mockResolvedValue(null);

    const req = makeRequest({
      token: "invalid-token",
      password: "newpassword123",
      confirmPassword: "newpassword123",
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(410);
    expect(json.error).toBe("INVALID_TOKEN");
  });

  it("returns 403 when user is suspended", async () => {
    mockUserFindUnique.mockResolvedValue({ ...ACTIVE_USER, status: "SUSPENDED" });

    const req = makeRequest({
      token: "tok",
      password: "newpassword123",
      confirmPassword: "newpassword123",
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("FORBIDDEN");
  });

  it("returns 404 when user no longer exists", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const req = makeRequest({
      token: "tok",
      password: "newpassword123",
      confirmPassword: "newpassword123",
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("NOT_FOUND");
  });
});
