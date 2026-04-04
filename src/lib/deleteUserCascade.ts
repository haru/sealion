import type { PrismaClient } from "@prisma/client";

/**
 * Deletes a user and all associated data atomically in a single transaction.
 *
 * Deletion order (dependency chain from leaf to root):
 * 1. Issue          — depends on Project
 * 2. Project        — depends on IssueProvider
 * 3. IssueProvider  — depends on User
 * 4. BoardSettings  — depends on User
 * 5. User           — root record
 *
 * `Account` and `Session` records are removed automatically via Prisma
 * `onDelete: Cascade` when the User row is deleted.
 *
 * @param prisma - Prisma client instance used to run the transaction.
 * @param userId - The ID of the user to delete.
 * @returns A promise that resolves when deletion is complete.
 * @throws Will re-throw any error raised by the Prisma transaction (caller is
 *         responsible for returning the appropriate error response).
 */
export async function deleteUserCascade(
  prisma: PrismaClient,
  userId: string
): Promise<void> {
  await prisma.$transaction([
    prisma.issue.deleteMany({ where: { project: { issueProvider: { userId } } } }),
    prisma.project.deleteMany({ where: { issueProvider: { userId } } }),
    prisma.issueProvider.deleteMany({ where: { userId } }),
    prisma.boardSettings.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}
