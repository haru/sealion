import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/projects/[id] — Updates the `includeUnassigned` setting for a project.
 * @param req - Request body must contain `includeUnassigned` (boolean).
 * @param params - Route params containing the project `id`.
 * @returns The updated project `{ id, includeUnassigned }`, or 400/401/403 on error.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.includeUnassigned !== "boolean") {
    return fail("MISSING_FIELDS", 400);
  }

  // Single atomic update — ownership enforced in the where clause (P2025 if not found/owned).
  const updated = await prisma.project
    .update({
      where: { id, issueProvider: { userId: session.user.id } },
      data: { includeUnassigned: body.includeUnassigned },
      select: { id: true, includeUnassigned: true },
    })
    .catch((e: unknown) => {
      if ((e as { code?: string }).code === "P2025") return null;
      throw e;
    });

  if (!updated) return fail("FORBIDDEN", 403);

  return ok(updated);
}

/**
 * DELETE /api/projects/[id] — Deletes a project owned by the authenticated user.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const { id } = await params;

  const result = await prisma.project.deleteMany({
    where: { id, issueProvider: { userId: session.user.id } },
  });
  if (result.count === 0) return fail("NOT_FOUND", 404);

  return new Response(null, { status: 204 });
}
