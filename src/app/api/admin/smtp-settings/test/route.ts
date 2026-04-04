import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { ok, fail } from "@/lib/api-response";
import { decrypt } from "@/lib/encryption";
import { getSmtpSettings } from "@/lib/smtp-settings";
import { sendMail, SMTP_DUMMY_PASSWORD } from "@/lib/smtp-mailer";

/** Zod schema for the test send POST request body. */
const testPayloadSchema = z
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
  if (!session) return { error: fail("UNAUTHORIZED", 401), session: null };
  if (session.user.role !== "ADMIN") return { error: fail("FORBIDDEN", 403), session: null };
  return { error: null, session };
}

/**
 * Resolves the SMTP password for a test send operation.
 *
 * - If `incoming` is the dummy sentinel, fetches and decrypts the stored
 *   encrypted password from the database.
 * - If `incoming` is `null`, returns `null` (no password / cleared).
 * - Otherwise, uses `incoming` directly (plaintext from the form).
 *
 * @param incoming - Password value from the request body.
 * @returns Resolved plaintext password, or `null` if no password is configured.
 */
async function resolveTestPassword(incoming: string | null): Promise<string | null> {
  if (incoming === SMTP_DUMMY_PASSWORD) {
    const settings = await getSmtpSettings();
    if (!settings?.encryptedPassword) return null;
    return decrypt(settings.encryptedPassword);
  }
  return incoming;
}

/**
 * POST /api/admin/smtp-settings/test — Sends a test email using the supplied SMTP config (admin only).
 *
 * Uses the logged-in admin's email as the recipient. If the password is the
 * dummy sentinel, the actual password is resolved from the database.
 *
 * @param req - Request body must match `testPayloadSchema`.
 * @returns 200 `{ sent: true }` on success, 400 if user email is missing, 422 on SMTP failure, 401, or 403.
 */
export async function POST(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body) return fail("INVALID_INPUT", 400);

  const parsed = testPayloadSchema.safeParse(body);
  if (!parsed.success) return fail("INVALID_INPUT", 400);

  const { host, port, fromAddress, fromName, requireAuth, username, password, useTls } = parsed.data;

  const recipientEmail = session?.user?.email ?? null;
  if (!recipientEmail) return fail("USER_EMAIL_MISSING", 400);

  const resolvedPassword = await resolveTestPassword(password);

  try {
    await sendMail({
      host,
      port,
      fromAddress,
      fromName,
      requireAuth,
      username,
      password: resolvedPassword,
      useTls,
      to: recipientEmail,
      subject: "Sealion SMTP Test Email",
      text: "This email was sent to verify your SMTP configuration. If you received this message, your settings are correct.",
    });

    return ok({ sent: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, 422);
  }
}
