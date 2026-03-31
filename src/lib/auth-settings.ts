import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AuthSettings } from "@prisma/client";

/**
 * Retrieves the current AuthSettings singleton record, creating it with defaults if absent.
 *
 * Performs a read-first lookup to avoid unnecessary writes and timestamp updates,
 * then creates the singleton record if it does not exist. In case of a concurrent
 * creation attempt, it falls back to a second read after handling the unique
 * constraint violation.
 *
 * @returns The singleton AuthSettings record.
 * @throws `Error` If the record cannot be created or retrieved after a unique constraint race.
 */
export async function getAuthSettings(): Promise<AuthSettings> {
  const existing = await prisma.authSettings.findUnique({
    where: { id: "singleton" },
  });

  if (existing) {
    return existing;
  }

  try {
    return await prisma.authSettings.create({
      data: { id: "singleton" },
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const afterConflict = await prisma.authSettings.findUnique({
        where: { id: "singleton" },
      });

      if (afterConflict) {
        return afterConflict;
      }

      throw new Error("AuthSettings singleton could not be created due to a unique constraint race.");
    }

    throw error;
  }
}
