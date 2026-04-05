/** @jest-environment node */
/**
 * Unit tests for GET /api/auth/confirm route.
 */

import { NextRequest } from "next/server";

jest.mock("@/lib/db/db", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/db";
import { verifyToken, TokenExpiredError, getAppBaseUrl } from "@/lib/email/email-verification";

const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockUserUpdate = prisma.user.update as jest.Mock;

jest.mock("@/lib/email/email-verification", () => ({
  verifyToken: jest.fn(),
  getAppBaseUrl: jest.fn().mockReturnValue("http://localhost:3000"),
  TokenExpiredError: class extends Error {
    constructor() { super("Token expired"); this.name = "TokenExpiredError"; }
  },
}));

const mockVerifyToken = verifyToken as jest.Mock;
const mockGetAppBaseUrl = getAppBaseUrl as jest.Mock;

function makeGetRequest(url: string): NextRequest {
  return new NextRequest(url);
}

describe("GET /api/auth/confirm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects to /login?verified=true for a valid token", async () => {
    mockVerifyToken.mockResolvedValue({ id: "user-1", email: "u@ex.com", status: "PENDING" });

    const { GET } = await import("@/app/api/auth/confirm/route");
    const res = await GET(makeGetRequest("http://localhost/api/auth/confirm?token=valid-token"));

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toContain("/login?verified=true");
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          status: "ACTIVE",
          emailVerificationToken: null,
          emailVerificationTokenExpires: null,
        }),
      }),
    );
  });

  it("redirects to /confirm?error=expired_token for an expired token", async () => {
    mockVerifyToken.mockRejectedValue(new TokenExpiredError());

    const { GET } = await import("@/app/api/auth/confirm/route");
    const res = await GET(makeGetRequest("http://localhost/api/auth/confirm?token=expired-token"));

    expect(res.status).toBe(307);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("expired_token");
    expect(location).toContain("/confirm?error=");
  });

  it("redirects to /confirm?error=invalid_token for an invalid token", async () => {
    mockVerifyToken.mockResolvedValue(null);

    const { GET } = await import("@/app/api/auth/confirm/route");
    const res = await GET(makeGetRequest("http://localhost/api/auth/confirm?token=bad-token"));

    expect(res.status).toBe(307);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("invalid_token");
    expect(location).toContain("/confirm?error=");
  });

  it("redirects to /confirm?error=missing_token when no token provided", async () => {
    const { GET } = await import("@/app/api/auth/confirm/route");
    const res = await GET(makeGetRequest("http://localhost/api/auth/confirm"));

    expect(res.status).toBe(307);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("missing_token");
    expect(location).toContain("/confirm?error=");
  });

  it("redirects to /login?verified=true for already-active user", async () => {
    mockVerifyToken.mockResolvedValue({ id: "user-2", email: "u2@ex.com", status: "ACTIVE" });

    const { GET } = await import("@/app/api/auth/confirm/route");
    const res = await GET(makeGetRequest("http://localhost/api/auth/confirm?token=active-token"));

    expect(res.status).toBe(307);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("/login?verified=true");
  });

  it("uses getAppBaseUrl() for the redirect host (AUTH_URL honored)", async () => {
    mockGetAppBaseUrl.mockReturnValue("https://myapp.example.com");
    mockVerifyToken.mockResolvedValue({ id: "user-3", email: "u3@ex.com", status: "PENDING" });

    const { GET } = await import("@/app/api/auth/confirm/route");
    const res = await GET(makeGetRequest("http://localhost/api/auth/confirm?token=any-token"));

    const location = res.headers.get("Location") ?? "";
    expect(location).toBe("https://myapp.example.com/login?verified=true");
  });

  it("redirects to /confirm?error=invalid_token for an unexpected non-TokenExpiredError thrown by verifyToken", async () => {
    mockVerifyToken.mockRejectedValue(new Error("unexpected database error"));

    const { GET } = await import("@/app/api/auth/confirm/route");
    const res = await GET(makeGetRequest("http://localhost/api/auth/confirm?token=error-token"));

    expect(res.status).toBe(307);
    const location = res.headers.get("Location") ?? "";
    expect(location).toContain("/confirm?error=invalid_token");
    expect(location).not.toContain("expired_token");
  });
});
