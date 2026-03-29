/** @jest-environment node */
import { POST } from "@/app/api/auth/setup/route";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

// Mock Prisma — includes $transaction for atomic setup guard
jest.mock("@/lib/db", () => ({
  prisma: {
    user: {
      count: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// Mock bcryptjs
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed_password"),
}));

import { prisma } from "@/lib/db";

const mockTransaction = prisma.$transaction as jest.Mock;

/** Transactional Prisma client shape used in $transaction callbacks. */
type TxClient = { user: { count: jest.Mock; create: jest.Mock } };

/**
 * Helper: simulate a successful $transaction by executing the callback with
 * a transactional Prisma client that uses controlled count/create mocks.
 * @param countResult - Value returned by `tx.user.count()` inside the transaction.
 * @param createResult - Value returned by `tx.user.create()` inside the transaction.
 * @returns A Jest mock implementation for `$transaction`.
 */
function simulateTransaction(countResult: number, createResult: object) {
  mockTransaction.mockImplementation(async (fn: (tx: TxClient) => Promise<unknown>) => {
    const tx: TxClient = {
      user: {
        count: jest.fn().mockResolvedValue(countResult),
        create: jest.fn().mockResolvedValue(createResult),
      },
    };
    return fn(tx);
  });
}

/**
 * Helper: simulate $transaction where the transactional count returns a rejection,
 * used to test DB error handling inside the transaction.
 * @param error - The error to throw from the transaction.
 */
function simulateTransactionError(error: unknown) {
  mockTransaction.mockRejectedValue(error);
}

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
    simulateTransaction(0, { id: "cladmin123", email: "admin@example.com", role: "ADMIN" });

    const req = makeRequest({ email: "admin@example.com", password: "password123", username: "Admin" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.email).toBe("admin@example.com");
    expect(json.data.role).toBe("ADMIN");
    expect(json.error).toBeNull();
  });

  it("creates user with ADMIN role inside the transaction", async () => {
    let capturedTx: TxClient | null = null;
    mockTransaction.mockImplementation(async (fn: (tx: TxClient) => Promise<unknown>) => {
      capturedTx = {
        user: {
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn().mockResolvedValue({ id: "cladmin123", email: "admin@example.com", role: "ADMIN" }),
        },
      };
      return fn(capturedTx);
    });

    const req = makeRequest({ email: "admin@example.com", password: "password123", username: "Admin" });
    await POST(req);

    expect(capturedTx).not.toBeNull();
    expect(capturedTx!.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: "ADMIN" }),
      })
    );
  });

  it("normalises email to lowercase before storing inside the transaction", async () => {
    let capturedTx: TxClient | null = null;
    mockTransaction.mockImplementation(async (fn: (tx: TxClient) => Promise<unknown>) => {
      capturedTx = {
        user: {
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn().mockResolvedValue({ id: "cladmin123", email: "admin@example.com", role: "ADMIN" }),
        },
      };
      return fn(capturedTx);
    });

    const req = makeRequest({ email: "  Admin@Example.COM  ", password: "password123", username: "Admin" });
    await POST(req);

    expect(capturedTx!.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: "admin@example.com" }),
      })
    );
  });

  it("passes username to user create inside the transaction when provided", async () => {
    let capturedTx: TxClient | null = null;
    mockTransaction.mockImplementation(async (fn: (tx: TxClient) => Promise<unknown>) => {
      capturedTx = {
        user: {
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn().mockResolvedValue({ id: "cladmin123", email: "admin@example.com", role: "ADMIN" }),
        },
      };
      return fn(capturedTx);
    });

    const req = makeRequest({ email: "admin@example.com", password: "password123", username: "Admin User" });
    await POST(req);

    expect(capturedTx!.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ username: "Admin User" }),
      })
    );
  });

  // --- US2: Guard when users already exist (atomic check inside transaction) ---

  it("returns 403 SETUP_ALREADY_DONE when transactional count is >= 1", async () => {
    // count=1 inside transaction → route must return 403 without calling create
    let capturedTx: TxClient | null = null;
    mockTransaction.mockImplementation(async (fn: (tx: TxClient) => Promise<unknown>) => {
      capturedTx = {
        user: {
          count: jest.fn().mockResolvedValue(1),
          create: jest.fn(),
        },
      };
      return fn(capturedTx);
    });

    const req = makeRequest({ email: "admin@example.com", password: "password123", username: "Admin" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("SETUP_ALREADY_DONE");
    expect(capturedTx!.user.create).not.toHaveBeenCalled();
  });

  it("uses $transaction so count-and-create are atomic (concurrency guard)", async () => {
    simulateTransaction(0, { id: "cladmin123", email: "admin@example.com", role: "ADMIN" });

    const req = makeRequest({ email: "admin@example.com", password: "password123", username: "Admin" });
    await POST(req);

    // The route must delegate to $transaction — not call prisma.user.count/create directly
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it("returns 409 EMAIL_ALREADY_EXISTS on Prisma P2002 unique constraint violation", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on the fields: (`email`)",
      { code: "P2002", clientVersion: "5.0.0", meta: {} }
    );
    simulateTransactionError(prismaError);

    const req = makeRequest({ email: "admin@example.com", password: "password123", username: "Admin" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("returns 500 INTERNAL_ERROR on unknown transaction error", async () => {
    simulateTransactionError(new Error("DB connection lost"));

    const req = makeRequest({ email: "admin@example.com", password: "password123", username: "Admin" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("INTERNAL_ERROR");
  });

  // --- US3: Validation (runs before transaction is reached) ---

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
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_EMAIL when email format is invalid", async () => {
    const req = makeRequest({ email: "not-an-email", password: "password123", username: "Admin" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("INVALID_EMAIL");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns 400 MISSING_USERNAME when username is not provided", async () => {
    const req = makeRequest({ email: "admin@example.com", password: "password123" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("MISSING_USERNAME");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns 400 MISSING_USERNAME when username is whitespace only", async () => {
    const req = makeRequest({ email: "admin@example.com", password: "password123", username: "   " });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("MISSING_USERNAME");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns 400 PASSWORD_TOO_SHORT when password is shorter than 8 chars", async () => {
    const req = makeRequest({ email: "admin@example.com", password: "short", username: "Admin" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("PASSWORD_TOO_SHORT");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns 400 PASSWORD_TOO_LONG when password exceeds 72 chars", async () => {
    const req = makeRequest({ email: "admin@example.com", password: "a".repeat(73), username: "Admin" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("PASSWORD_TOO_LONG");
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
