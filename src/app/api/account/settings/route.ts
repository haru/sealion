import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/api-response";
import { auth } from "@/lib/auth/auth";
import { BCRYPT_ROUNDS } from "@/lib/auth/bcrypt-config";
import { prisma } from "@/lib/db/db";

const MAX_USERNAME_LENGTH = 50;
const MAX_PASSWORD_LENGTH = 72;

const baseSchema = z.object({
  username: z.string().nullable(),
  useGravatar: z.boolean(),
  changePassword: z.boolean(),
});

const withPasswordSchema = baseSchema.extend({
  changePassword: z.literal(true),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(MAX_PASSWORD_LENGTH),
});

const withoutPasswordSchema = baseSchema.extend({
  changePassword: z.literal(false),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
});

const patchSettingsSchema = z.discriminatedUnion("changePassword", [
  withPasswordSchema,
  withoutPasswordSchema,
]);

/**
 * Atomically updates username, Gravatar preference, and optionally the password
 * for the authenticated user in a single Prisma write.
 *
 * @returns `200 { data: null, error: null }` on success.
 *          `400` with a specific error code on validation failure.
 *          `401` when unauthenticated or the user record is not found.
 *          `500` on unexpected server error.
 */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return fail("UNAUTHORIZED", 401);
  }

  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("INVALID_INPUT", 400);
  }

  const parseResult = patchSettingsSchema.safeParse(body);
  if (!parseResult.success) {
    const issues = parseResult.error.issues;
    // Surface more specific error codes for password validation failures
    const hasTooShort = issues.some(
      (i) => i.path.includes("newPassword") && i.code === "too_small"
    );
    if (hasTooShort) { return fail("PASSWORD_TOO_SHORT", 400); }

    const hasTooLong = issues.some(
      (i) => i.path.includes("newPassword") && i.code === "too_big"
    );
    if (hasTooLong) { return fail("PASSWORD_TOO_LONG", 400); }

    const hasCurrentRequired = issues.some(
      (i) => i.path.includes("currentPassword") && i.code === "too_small"
    );
    if (hasCurrentRequired) { return fail("PASSWORD_CURRENT_REQUIRED", 400); }

    return fail("INVALID_INPUT", 400);
  }

  const parsed = parseResult.data;

  // Normalise username
  const rawUsername = parsed.username;
  const trimmed = rawUsername === null ? null : rawUsername.trim();
  const username = trimmed !== null && trimmed.length === 0 ? null : trimmed;

  if (username !== null && username.length > MAX_USERNAME_LENGTH) {
    return fail("USERNAME_TOO_LONG", 400);
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return fail("UNAUTHORIZED", 401);
    }

    let newPasswordHash: string | undefined;

    if (parsed.changePassword) {
      const isCorrect = await bcrypt.compare(parsed.currentPassword, user.passwordHash);
      if (!isCorrect) {
        return fail("PASSWORD_INCORRECT", 400);
      }
      newPasswordHash = await bcrypt.hash(parsed.newPassword, BCRYPT_ROUNDS);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        username,
        useGravatar: parsed.useGravatar,
        ...(newPasswordHash !== undefined && {
          passwordHash: newPasswordHash,
          passwordChangedAt: new Date(),
        }),
      },
    });

    return ok(null);
  } catch (err: unknown) {
    console.error("[account/settings] PATCH failed", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return fail("INTERNAL_ERROR", 500);
  }
}
