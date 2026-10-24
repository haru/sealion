/**
 * AuthSettings access: reads (or creates) the singleton settings row and exposes the cached
 * idle-timeout lookup used by the session checks.
 */

import { Prisma, type AuthSettings } from "@prisma/client";
import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/db/db";

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

/** Cache tag for {@link getSessionTimeoutMinutes}; invalidated by the admin settings PATCH handler. */
export const AUTH_SETTINGS_CACHE_TAG = "auth-settings" as const;

const SESSION_TIMEOUT_TTL_SECONDS = 30;

/**
 * Returns the configured idle session timeout, cached for 30 seconds.
 *
 * Called by the jwt callback on every authenticated request, so it must not hit the
 * database each time. The admin settings handler invalidates the cache on change; other
 * server instances may serve the previous value for up to 30 seconds. Errors are not cached:
 * they propagate to the caller, so session validation fails closed.
 *
 * @returns The idle timeout in minutes, or `null` when no timeout is configured.
 * @throws `Error` When the AuthSettings singleton cannot be read or created.
 */
export const getSessionTimeoutMinutes = unstable_cache(
  async (): Promise<number | null> => (await getAuthSettings()).sessionTimeoutMinutes,
  ["auth-settings:session-timeout"],
  { tags: [AUTH_SETTINGS_CACHE_TAG], revalidate: SESSION_TIMEOUT_TTL_SECONDS },
);
