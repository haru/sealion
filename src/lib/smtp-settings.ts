import { prisma } from "@/lib/db";
import type { SmtpSettings } from "@prisma/client";

/**
 * Retrieves the SmtpSettings singleton record from the database.
 *
 * Returns `null` if no SMTP settings have been saved yet (i.e., the admin
 * has not configured SMTP for this installation). Unlike `AuthSettings`, this
 * singleton is NOT auto-created with defaults — it only exists after the admin
 * explicitly saves configuration via the SMTP settings page.
 *
 * @returns The singleton SmtpSettings record, or `null` if not yet configured.
 */
export async function getSmtpSettings(): Promise<SmtpSettings | null> {
  return prisma.smtpSettings.findUnique({ where: { id: "singleton" } });
}
