import { prisma } from "@/lib/db";
import type { AuthSettings } from "@prisma/client";

/**
 * Retrieves the current AuthSettings singleton record, creating it with defaults if absent.
 *
 * Uses upsert so callers never need to handle the "record not yet created" case.
 *
 * @returns The singleton AuthSettings record.
 */
export async function getAuthSettings(): Promise<AuthSettings> {
  return prisma.authSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}
