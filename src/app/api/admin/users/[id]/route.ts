import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";
import { UserRole } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);
  if (session.user.role !== "ADMIN") return fail("FORBIDDEN", 403);

  const { id } = await params;

  // Prevent self-deactivation
  if (id === session.user.id) {
    return fail("CANNOT_DEACTIVATE_SELF", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return fail("INVALID_BODY", 400);

  const { isActive, role } = body as { isActive?: boolean; role?: string };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return fail("NOT_FOUND", 404);

  const updateData: Record<string, unknown> = {};
  if (typeof isActive === "boolean") updateData.isActive = isActive;
  if (role && Object.values(UserRole).includes(role as UserRole)) updateData.role = role;

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, email: true, role: true, isActive: true },
  });

  return ok(updated);
}
