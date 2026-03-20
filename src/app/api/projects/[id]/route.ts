import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fail } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, issueProvider: { userId: session.user.id } },
  });
  if (!project) return fail("NOT_FOUND", 404);

  await prisma.project.delete({ where: { id } });

  return new Response(null, { status: 204 });
}
