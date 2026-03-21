import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fail } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

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
