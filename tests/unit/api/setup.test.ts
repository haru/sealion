/** @jest-environment node */
import { POST } from "@/app/api/auth/setup/route";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

// Mock Prisma
jest.mock("@/lib/db", () => ({
  prisma: {
    user: {
      count: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock bcryptjs
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed_password"),
}));

import { prisma } from "@/lib/db";

const mockCount = prisma.user.count as jest.Mock;
const mockCreate = prisma.user.create as jest.Mock;

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/auth/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/setup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- US1: Happy path ---

  it("returns 201 with ADMIN role on success when no users exist", async () => {
    mockCount.mockResolvedValue(0);
    mockCreate.mockResolvedValue({
      id: "cladmin123",
      email: "admin@example.com",
      role: "ADMIN",
    });

    const req = makeRequest({ email: "admin@example.com", password: "password123" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.email).toBe("admin@example.com");
    expect(json.data.role).toBe("ADMIN");
    expect(json.error).toBeNull();
  });

  it("creates user with ADMIN role (verifies create call)", async () => {
    mockCount.mockResolvedValue(0);
    mockCreate.mockResolvedValue({ id: "cladmin123", email: "admin@example.com", role: "ADMIN" });

    const req = makeRequest({ email: "admin@example.com", password: "password123" });
    await POST(req);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: "ADMIN" }),
      })
    );
  });

  it("normalises email to lowercase before storing", async () => {
    mockCount.mockResolvedValue(0);
    mockCreate.mockResolvedValue({ id: "cladmin123", email: "admin@example.com", role: "ADMIN" });

    const req = makeRequest({ email: "  Admin@Example.COM  ", password: "password123" });
    await POST(req);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "admin@example.com" }),
      })
    );
  });

  // --- US2: Guard when users already exist ---

  it("returns 403 SETUP_ALREADY_DONE when user count is >= 1", async () => {
    mockCount.mockResolvedValue(1);

    const req = makeRequest({ email: "admin@example.com", password: "password123" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("SETUP_ALREADY_DONE");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns 409 EMAIL_ALREADY_EXISTS on Prisma P2002 unique constraint violation", async () => {
    mockCount.mockResolvedValue(0);
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`email`)",
      { code: "P2002", clientVersion: "5.0.0", meta: {} }
    );
    mockCreate.mockRejectedValue(prismaError);

    const req = makeRequest({ email: "admin@example.com", password: "password123" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("EMAIL_ALREADY_EXISTS");
  });

  // --- US3: Validation ---

  it("returns 400 INVALID_INPUT when body is missing", async () => {
    const req = new NextRequest("http://localhost/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_INPUT");
  });

  it("returns 400 INVALID_EMAIL when email format is invalid", async () => {
    const req = makeRequest({ email: "not-an-email", password: "password123" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_EMAIL");
  });

  it("returns 400 PASSWORD_TOO_SHORT when password is shorter than 8 chars", async () => {
    const req = makeRequest({ email: "admin@example.com", password: "short" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("PASSWORD_TOO_SHORT");
  });

  it("returns 400 PASSWORD_TOO_LONG when password exceeds 72 chars", async () => {
    const req = makeRequest({ email: "admin@example.com", password: "a".repeat(73) });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("PASSWORD_TOO_LONG");
  });
});
