import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";

/**
 * PATCH /api/issues/today/reorder — Reorders today's flagged issues for the authenticated user.
 * @param req - Request body must contain `orderedIds`: an ordered array of issue IDs (1–100 elements).
 * @returns JSON response envelope `{ data: { updated: number } | null, error: string | null }`.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const body = await req.json().catch(() => null);
  if (!body) return fail("INVALID_BODY", 400);

  const { orderedIds } = body as { orderedIds?: unknown[] };
  if (!Array.isArray(orderedIds) || orderedIds.length === 0 || orderedIds.length > 100) {
    return fail("INVALID_IDS", 400);
  }
  if (!orderedIds.every((id): id is string => typeof id === "string")) {
    return fail("INVALID_IDS", 400);
  }

  if (new Set(orderedIds).size !== orderedIds.length) {
    return fail("INVALID_IDS", 400);
  }

  // Verify all ids belong to the session user and have todayFlag=true
  const ownedIssues = await prisma.issue.findMany({
    where: {
      id: { in: orderedIds },
      todayFlag: true,
      project: { issueProvider: { userId: session.user.id } },
    },
    select: { id: true },
  });

  if (ownedIssues.length !== orderedIds.length) {
    return fail("FORBIDDEN", 403);
  }

  // Update todayOrder for each issue in a transaction (Last Write Wins).
  // Ownership is re-enforced inside the transaction as defense-in-depth.
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.issue.updateMany({
        where: { id, project: { issueProvider: { userId: session.user.id } } },
        data: { todayOrder: index + 1 },
      })
    )
  );

  return ok({ updated: orderedIds.length });
}
