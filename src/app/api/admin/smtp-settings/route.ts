import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/api-response";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/db";
import { SMTP_DUMMY_PASSWORD } from "@/lib/email/smtp-mailer";
import { encrypt } from "@/lib/encryption/encryption";

/** Zod schema for the SMTP settings PUT request body. */
const smtpSettingsSchema = z
  .object({
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    fromAddress: z.string().email(),
    fromName: z.string().min(1),
    requireAuth: z.boolean(),
    username: z.string().nullable(),
    password: z.string().nullable(),
    useTls: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!value.requireAuth) {
      return;
    }

    if (value.username === null || value.username.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["username"],
        message: "USERNAME_REQUIRED_WHEN_AUTH_ENABLED",
      });
    }

    if (value.password === null || value.password.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "PASSWORD_REQUIRED_WHEN_AUTH_ENABLED",
      });
    }
  });

/** Verifies the current session belongs to an admin user. */
async function requireAdmin() {
  const session = await auth();
  if (!session) { return { error: fail("UNAUTHORIZED", 401), session: null }; }
  if (session.user.role !== "ADMIN") { return { error: fail("FORBIDDEN", 403), session: null }; }
  return { error: null, session };
}

/**
 * Resolves the stored password value for a PUT (save) operation.
 *
 * - If `incoming` is the dummy sentinel, keeps `existing` unchanged.
 * - If `incoming` is `null` or empty, clears the password (returns `null`).
 * - Otherwise, encrypts the new plaintext password.
 *
 * @param incoming - Password value from the request body.
 * @param existing - Current encrypted password from the database, or `null`.
 * @returns The encrypted password to persist, or `null`.
 */
function resolvePassword(incoming: string | null, existing: string | null): string | null {
  if (incoming === SMTP_DUMMY_PASSWORD) { return existing; }
  if (incoming === null || incoming.length === 0) { return null; }
  return encrypt(incoming);
}

/**
 * GET /api/admin/smtp-settings — Returns current SMTP settings (admin only).
 *
 * Password is never returned; `hasPassword` indicates if one is stored.
 *
 * @returns 200 with `SmtpSettingsResponse | null`, 401, or 403.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) { return error; }

  const settings = await prisma.smtpSettings.findUnique({ where: { id: "singleton" } });

  if (!settings) {
    return ok(null);
  }

  return ok({
    host: settings.host,
    port: settings.port,
    fromAddress: settings.fromAddress,
    fromName: settings.fromName,
    requireAuth: settings.requireAuth,
    username: settings.username,
    hasPassword: !!settings.encryptedPassword,
    useTls: settings.useTls,
  });
}

/**
 * PUT /api/admin/smtp-settings — Creates or updates the SMTP settings singleton (admin only).
 *
 * Password handling: if the incoming password is `null` or the dummy sentinel
 * value, the existing encrypted password is preserved. Otherwise, the new
 * password is encrypted and stored.
 *
 * @param req - Request body must match `smtpSettingsSchema`.
 * @returns 200 with updated `SmtpSettingsResponse`, 400 for invalid payload, 401, or 403.
 */
export async function PUT(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) { return error; }

  const body = await req.json().catch(() => null);
  if (!body) { return fail("INVALID_INPUT", 400); }

  const parsed = smtpSettingsSchema.safeParse(body);
  if (!parsed.success) { return fail("INVALID_INPUT", 400); }

  const { host, port, fromAddress, fromName, requireAuth, username, password, useTls } = parsed.data;

  const existing = await prisma.smtpSettings.findUnique({ where: { id: "singleton" } });
  const encryptedPassword = resolvePassword(password, existing?.encryptedPassword ?? null);

  const settings = await prisma.smtpSettings.upsert({
    where: { id: "singleton" },
    update: { host, port, fromAddress, fromName, requireAuth, username, encryptedPassword, useTls },
    create: { id: "singleton", host, port, fromAddress, fromName, requireAuth, username, encryptedPassword, useTls },
  });

  return ok({
    host: settings.host,
    port: settings.port,
    fromAddress: settings.fromAddress,
    fromName: settings.fromName,
    requireAuth: settings.requireAuth,
    username: settings.username,
    hasPassword: !!settings.encryptedPassword,
    useTls: settings.useTls,
  });
}
