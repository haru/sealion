import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/api-response";
import { auth } from "@/lib/auth/auth";
import { getAuthSettings } from "@/lib/auth/auth-settings";
import { prisma } from "@/lib/db/db";

/** Valid values for sessionTimeoutMinutes (null = no timeout). */
const VALID_TIMEOUT_VALUES = new Set([null, 60, 360, 720, 1440, 10080, 43200, 129600]);

/** Verifies the current session belongs to an admin user. */
async function requireAdmin() {
  const session = await auth();
  if (!session) { return { error: fail("UNAUTHORIZED", 401) }; }
  if (session.user.role !== "ADMIN") { return { error: fail("FORBIDDEN", 403) }; }
  return { error: null };
}

/**
 * GET /api/admin/auth-settings — Returns the current auth settings (admin only).
 *
 * Creates the singleton record with defaults if it does not yet exist.
 *
 * @returns 200 with `{ allowUserSignup, sessionTimeoutMinutes, requireEmailVerification }`, 401, or 403.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) { return error; }

  const settings = await getAuthSettings();

  return ok({
    allowUserSignup: settings.allowUserSignup,
    sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
    requireEmailVerification: settings.requireEmailVerification,
  });
}

/**
 * PATCH /api/admin/auth-settings — Partially updates auth settings (admin only).
 *
 * Accepted fields: `allowUserSignup` (boolean), `sessionTimeoutMinutes` (number|null),
 * `requireEmailVerification` (boolean). Unknown fields are ignored.
 * `requireEmailVerification` can only be `true` when `allowUserSignup` is `true`.
 *
 * @param req - The incoming request with optional fields.
 * @returns 200 with updated settings, 400 for validation errors, 401, or 403.
 */
export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) { return error; }

  const body = await req.json().catch(() => ({})) as unknown;

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return fail("INVALID_INPUT", 400);
  }

  const record = body as Record<string, unknown>;
  const data: {
    allowUserSignup?: boolean;
    sessionTimeoutMinutes?: number | null;
    requireEmailVerification?: boolean;
  } = {};

  if ("allowUserSignup" in record) {
    if (typeof record.allowUserSignup !== "boolean") { return fail("INVALID_INPUT", 400); }
    data.allowUserSignup = record.allowUserSignup;
  }

  if ("sessionTimeoutMinutes" in record) {
    const val = record.sessionTimeoutMinutes;
    if (val !== null && typeof val !== "number") { return fail("INVALID_INPUT", 400); }
    if (!VALID_TIMEOUT_VALUES.has(val as number | null)) { return fail("INVALID_TIMEOUT", 400); }
    data.sessionTimeoutMinutes = val as number | null;
  }

  if ("requireEmailVerification" in record) {
    if (typeof record.requireEmailVerification !== "boolean") { return fail("INVALID_INPUT", 400); }
    data.requireEmailVerification = record.requireEmailVerification;
  }

  // Validate that requireEmailVerification requires allowUserSignup to be true
  if (data.requireEmailVerification === true) {
    const effectiveAllowSignup = data.allowUserSignup ?? (await getAuthSettings()).allowUserSignup;
    if (!effectiveAllowSignup) {
      return fail("INVALID_INPUT", 400);
    }
  }

  const settings = await prisma.authSettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  return ok({
    allowUserSignup: settings.allowUserSignup,
    sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
    requireEmailVerification: settings.requireEmailVerification,
  });
}
