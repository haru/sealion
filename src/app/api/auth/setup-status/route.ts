import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";

/**
 * GET /api/auth/setup-status — Returns whether first-time admin setup is required.
 *
 * Called by the middleware on every non-API page request to determine whether
 * the database has any users. Returns `{ needsSetup: true }` when the `User`
 * table is empty, and `{ needsSetup: false }` otherwise.
 *
 * @returns 200 with `{ data: { needsSetup: boolean }, error: null }`, or 500 on DB failure.
 */
export async function GET() {
  try {
    const count = await prisma.user.count();
    return ok({ needsSetup: count === 0 });
  } catch {
    return fail("INTERNAL_ERROR", 500);
  }
}
