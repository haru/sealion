import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";
import { getProviderIconUrl } from "@/services/issue-provider/factory";

/**
 * GET /api/issues — Returns a paginated list of issues for the authenticated user.
 * Issues in the today list (todayFlag=true) are excluded — those are shown in the Today widget.
 * @param req - Supports query params: `page`, `limit`.
 * @returns JSON response in the standard `{ data, error }` envelope where `data` is `{ items, total, totalToday, page, limit }` on success.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));

  const baseWhere = {
    project: {
      issueProvider: { userId: session.user.id },
    },
  };

  const regularWhere = {
    ...baseWhere,
    // Exclude issues in today's list — those are shown in the Today widget instead.
    todayFlag: { not: true },
  };

  const todayWhere = {
    ...baseWhere,
    todayFlag: true,
  };

  const [total, totalToday, items] = await Promise.all([
    prisma.issue.count({ where: regularWhere }),
    prisma.issue.count({ where: todayWhere }),
    prisma.issue.findMany({
      where: regularWhere,
      orderBy: [
        { dueDate: { sort: "asc", nulls: "last" } },
        { providerUpdatedAt: { sort: "desc", nulls: "last" } },
        { providerCreatedAt: { sort: "desc", nulls: "last" } },
      ],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        externalId: true,
        title: true,
        dueDate: true,
        externalUrl: true,
        isUnassigned: true,
        todayFlag: true,
        todayOrder: true,
        todayAddedAt: true,
        providerCreatedAt: true,
        providerUpdatedAt: true,
        project: {
          select: {
            displayName: true,
            issueProvider: {
              select: { type: true, displayName: true },
            },
          },
        },
      },
    }),
  ]);

  const itemsWithIconUrl = items.map((issue) => ({
    ...issue,
    project: {
      ...issue.project,
      issueProvider: {
        ...issue.project.issueProvider,
        iconUrl: getProviderIconUrl(issue.project.issueProvider.type),
      },
    },
  }));

  return ok({ items: itemsWithIconUrl, total, totalToday, page, limit });
}
