import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";

/** Valid values for sessionTimeoutMinutes (null = no timeout). */
const VALID_TIMEOUT_VALUES = new Set([null, 60, 360, 720, 1440, 10080, 43200, 129600]);

/** Verifies the current session belongs to an admin user. */
async function requireAdmin() {
  const session = await auth();
  if (!session) return { error: fail("UNAUTHORIZED", 401) };
  if (session.user.role !== "ADMIN") return { error: fail("FORBIDDEN", 403) };
  return { error: null };
}

/**
 * GET /api/admin/auth-settings — Returns the current auth settings (admin only).
 *
 * Creates the singleton record with defaults if it does not yet exist.
 *
 * @returns 200 with `{ allowUserSignup, sessionTimeoutMinutes }`, 401, or 403.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const settings = await prisma.authSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  return ok({ allowUserSignup: settings.allowUserSignup, sessionTimeoutMinutes: settings.sessionTimeoutMinutes });
}

/**
 * PATCH /api/admin/auth-settings — Partially updates auth settings (admin only).
 *
 * Accepted fields: `allowUserSignup` (boolean), `sessionTimeoutMinutes` (number|null).
 * Unknown fields are ignored. An empty body is accepted without making changes.
 *
 * @param req - The incoming request with optional `allowUserSignup` and/or `sessionTimeoutMinutes`.
 * @returns 200 with updated settings, 400 for validation errors, 401, or 403.
 */
export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const data: { allowUserSignup?: boolean; sessionTimeoutMinutes?: number | null } = {};

  if ("allowUserSignup" in body) {
    if (typeof body.allowUserSignup !== "boolean") return fail("INVALID_INPUT", 400);
    data.allowUserSignup = body.allowUserSignup;
  }

  if ("sessionTimeoutMinutes" in body) {
    const val = body.sessionTimeoutMinutes;
    if (val !== null && typeof val !== "number") return fail("INVALID_INPUT", 400);
    if (!VALID_TIMEOUT_VALUES.has(val as number | null)) return fail("INVALID_TIMEOUT", 400);
    data.sessionTimeoutMinutes = val as number | null;
  }

  const settings = await prisma.authSettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  return ok({ allowUserSignup: settings.allowUserSignup, sessionTimeoutMinutes: settings.sessionTimeoutMinutes });
}
