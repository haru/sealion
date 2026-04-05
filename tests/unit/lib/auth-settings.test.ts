/** @jest-environment node */
/**
 * Unit tests for getAuthSettings in src/lib/auth-settings.ts.
 */

import { Prisma } from "@prisma/client";

jest.mock("@/lib/db/db", () => ({
  prisma: {
    authSettings: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/db";

const mockFindUnique = prisma.authSettings.findUnique as jest.Mock;
const mockCreate = prisma.authSettings.create as jest.Mock;

const SINGLETON = { id: "singleton", allowUserSignup: true, sessionTimeoutMinutes: null, updatedAt: new Date() };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getAuthSettings", () => {
  it("returns existing record when found", async () => {
    mockFindUnique.mockResolvedValue(SINGLETON);

    const { getAuthSettings } = await import("@/lib/auth/auth-settings");
    const result = await getAuthSettings();

    expect(result).toBe(SINGLETON);
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "singleton" } });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates the record when it does not exist", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(SINGLETON);

    const { getAuthSettings } = await import("@/lib/auth/auth-settings");
    const result = await getAuthSettings();

    expect(result).toBe(SINGLETON);
    expect(mockCreate).toHaveBeenCalledWith({ data: { id: "singleton" } });
  });

  it("falls back to findUnique after P2002 unique constraint violation", async () => {
    mockFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(SINGLETON);

    const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "0.0.0",
    });
    mockCreate.mockRejectedValue(prismaError);

    const { getAuthSettings } = await import("@/lib/auth/auth-settings");
    const result = await getAuthSettings();

    expect(result).toBe(SINGLETON);
    expect(mockFindUnique).toHaveBeenCalledTimes(2);
  });

  it("throws when P2002 occurs but second findUnique returns null", async () => {
    mockFindUnique.mockResolvedValue(null);

    const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "0.0.0",
    });
    mockCreate.mockRejectedValue(prismaError);

    const { getAuthSettings } = await import("@/lib/auth/auth-settings");

    await expect(getAuthSettings()).rejects.toThrow(
      "AuthSettings singleton could not be created due to a unique constraint race.",
    );
  });

  it("re-throws non-P2002 errors from create", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockRejectedValue(new Error("Some DB error"));

    const { getAuthSettings } = await import("@/lib/auth/auth-settings");

    await expect(getAuthSettings()).rejects.toThrow("Some DB error");
  });
});
