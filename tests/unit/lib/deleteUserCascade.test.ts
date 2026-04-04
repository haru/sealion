/** @jest-environment node */
/**
 * Unit tests for deleteUserCascade utility.
 *
 * Tests cascade deletion logic without a real database by mocking Prisma.
 */

import type { PrismaClient } from "@prisma/client";

const TEST_USER_ID = "test-user-cascade-001";

/** Creates a mock Prisma client with controllable transaction behaviour. */
function makeMockPrisma(transactionImpl?: (ops: unknown[]) => Promise<unknown[]>) {
  const issueDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const projectDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const issueProviderDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const boardSettingsDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const userDelete = jest.fn().mockResolvedValue({ id: TEST_USER_ID });

  const $transaction = transactionImpl
    ? jest.fn().mockImplementation(transactionImpl)
    : jest.fn().mockImplementation(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));

  return {
    issue: { deleteMany: issueDeleteMany },
    project: { deleteMany: projectDeleteMany },
    issueProvider: { deleteMany: issueProviderDeleteMany },
    boardSettings: { deleteMany: boardSettingsDeleteMany },
    user: { delete: userDelete },
    $transaction,
    _mocks: { issueDeleteMany, projectDeleteMany, issueProviderDeleteMany, boardSettingsDeleteMany, userDelete, $transaction },
  };
}

describe("deleteUserCascade", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test("calls $transaction with correct operations for a user with data", async () => {
    const mockPrisma = makeMockPrisma();
    const { deleteUserCascade } = await import("@/lib/deleteUserCascade");

    await deleteUserCascade(mockPrisma as unknown as PrismaClient, TEST_USER_ID);

    expect(mockPrisma._mocks.$transaction).toHaveBeenCalledTimes(1);

    // Verify each deleteMany / delete was called with the right userId
    expect(mockPrisma.issue.deleteMany).toHaveBeenCalledWith({
      where: { project: { issueProvider: { userId: TEST_USER_ID } } },
    });
    expect(mockPrisma.project.deleteMany).toHaveBeenCalledWith({
      where: { issueProvider: { userId: TEST_USER_ID } },
    });
    expect(mockPrisma.issueProvider.deleteMany).toHaveBeenCalledWith({
      where: { userId: TEST_USER_ID },
    });
    expect(mockPrisma.boardSettings.deleteMany).toHaveBeenCalledWith({
      where: { userId: TEST_USER_ID },
    });
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({
      where: { id: TEST_USER_ID },
    });
  });

  test("succeeds for a user with no associated data (all deletions return count 0)", async () => {
    const mockPrisma = makeMockPrisma();
    const { deleteUserCascade } = await import("@/lib/deleteUserCascade");

    // Should resolve without throwing even when there are no related records
    await expect(deleteUserCascade(mockPrisma as unknown as PrismaClient, TEST_USER_ID)).resolves.toBeUndefined();
    expect(mockPrisma._mocks.$transaction).toHaveBeenCalledTimes(1);
  });

  test("propagates error when transaction fails (rollback scenario)", async () => {
    const transactionError = new Error("Transaction failed — DB error");
    const mockPrisma = makeMockPrisma(async () => {
      throw transactionError;
    });
    const { deleteUserCascade } = await import("@/lib/deleteUserCascade");

    await expect(
      deleteUserCascade(mockPrisma as unknown as PrismaClient, TEST_USER_ID)
    ).rejects.toThrow("Transaction failed — DB error");
  });
});
