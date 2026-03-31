/** @jest-environment node */
import { POST } from "@/app/api/auth/signup/route";
import { NextRequest } from "next/server";

// Mock Prisma
jest.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    authSettings: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock bcryptjs
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed_password"),
}));

import { prisma } from "@/lib/db";

const mockFindUnique = prisma.user.findUnique as jest.Mock;
const mockCreate = prisma.user.create as jest.Mock;
const mockAuthSettingsFindUnique = prisma.authSettings.findUnique as jest.Mock;

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
    // Default: signup enabled
    mockAuthSettingsFindUnique.mockResolvedValue({ id: "singleton", allowUserSignup: true, sessionTimeoutMinutes: null, updatedAt: new Date() });
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

  it("returns 403 SIGNUP_DISABLED when allowUserSignup is false", async () => {
    mockAuthSettingsFindUnique.mockResolvedValue({ id: "singleton", allowUserSignup: false, sessionTimeoutMinutes: null, updatedAt: new Date() });

    const req = makeRequest({ email: "user@example.com", password: "password123", username: "Alice" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("SIGNUP_DISABLED");
  });

  it("proceeds normally when allowUserSignup is true", async () => {
    mockAuthSettingsFindUnique.mockResolvedValue({ id: "singleton", allowUserSignup: true, sessionTimeoutMinutes: null, updatedAt: new Date() });
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "clyyyy", email: "user2@example.com", role: "USER" });

    const req = makeRequest({ email: "user2@example.com", password: "password123", username: "Bob" });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });
});
