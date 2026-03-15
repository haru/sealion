import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const { id } = await params;

  // Verify ownership
  const provider = await prisma.issueProvider.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!provider) return fail("FORBIDDEN", 403);

  await prisma.issueProvider.delete({ where: { id } });

  return ok({ id });
}
