import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.includeUnassigned !== "boolean") {
    return fail("MISSING_FIELDS", 400);
  }

  const result = await prisma.project.updateMany({
    where: { id, issueProvider: { userId: session.user.id } },
    data: { includeUnassigned: body.includeUnassigned },
  });
  if (result.count === 0) return fail("FORBIDDEN", 403);

  const updated = await prisma.project.findUnique({
    where: { id },
    select: { id: true, includeUnassigned: true },
  });

  return ok(updated);
}

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
