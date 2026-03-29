import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";

/**
 * Changes the authenticated user's password.
 *
 * Validates that `currentPassword` matches the stored bcrypt hash, then replaces
 * `passwordHash` with a fresh hash of `newPassword`.
 *
 * @param request - The incoming PATCH request containing `currentPassword` and `newPassword`.
 * @returns `200 { data: null, error: null }` on success,
 *          `400` on validation failure or wrong current password,
 *          `401` if unauthenticated,
 *          `500` on unexpected server error.
 */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request body", 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).currentPassword !== "string" ||
    typeof (body as Record<string, unknown>).newPassword !== "string"
  ) {
    return fail("Invalid request body", 400);
  }

  const { currentPassword, newPassword } = body as { currentPassword: string; newPassword: string };

  if (!currentPassword) {
    return fail("Current password is required.", 400);
  }

  if (newPassword.length < 8) {
    return fail("New password must be at least 8 characters.", 400);
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return fail("Unauthorized", 401);
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return fail("Current password is incorrect.", 400);
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return ok(null);
  } catch {
    return fail("Internal server error", 500);
  }
}
