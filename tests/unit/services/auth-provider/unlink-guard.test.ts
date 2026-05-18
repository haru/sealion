/** @jest-environment node */
/**
 * Unit tests for the `canUnlinkAccount` guard helper (T055).
 * Verifies that a user cannot unlink their last authentication method.
 */

jest.mock("@/lib/db/db", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    account: {
      count: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/db";

const mockUserFind = prisma.user.findUnique as jest.Mock;
const mockAccountCount = prisma.account.count as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("canUnlinkAccount", () => {
  it("returns true when user has a passwordHash (local auth available)", async () => {
    const { canUnlinkAccount } = await import("@/services/auth-provider/account-linking");
    mockUserFind.mockResolvedValue({ id: "u1", passwordHash: "$2a$10$hash" });
    mockAccountCount.mockResolvedValue(1);

    const result = await canUnlinkAccount("u1", "google");
    expect(result).toBe(true);
  });

  it("returns true when other Accounts remain after unlinking", async () => {
    const { canUnlinkAccount } = await import("@/services/auth-provider/account-linking");
    mockUserFind.mockResolvedValue({ id: "u1", passwordHash: null });
    mockAccountCount.mockResolvedValue(2);

    const result = await canUnlinkAccount("u1", "google");
    expect(result).toBe(true);
  });

  it("returns false when passwordHash is null and this is the last Account", async () => {
    const { canUnlinkAccount } = await import("@/services/auth-provider/account-linking");
    mockUserFind.mockResolvedValue({ id: "u1", passwordHash: null });
    mockAccountCount.mockResolvedValue(1);

    const result = await canUnlinkAccount("u1", "google");
    expect(result).toBe(false);
  });

  it("returns false when user is not found", async () => {
    const { canUnlinkAccount } = await import("@/services/auth-provider/account-linking");
    mockUserFind.mockResolvedValue(null);

    const result = await canUnlinkAccount("nonexistent", "google");
    expect(result).toBe(false);
  });
});
