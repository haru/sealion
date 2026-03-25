import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";
import { getProviderIconUrl } from "@/services/issue-provider/factory";
import { VALID_SORT_CRITERIA, SortCriterion } from "@/lib/types";

type PrismaOrderBy = Record<string, { sort: string; nulls: string }>;

/** Default sort order when no `sortOrder` query parameter is provided. */
const DEFAULT_SORT_CRITERIA: SortCriterion[] = ["dueDate_asc", "providerUpdatedAt_desc"];

/**
 * Converts a {@link SortCriterion} to a Prisma `orderBy` entry.
 * @param criterion - The sort criterion to convert.
 * @returns A Prisma orderBy object for the criterion.
 */
function criterionToOrderBy(criterion: SortCriterion): PrismaOrderBy {
  switch (criterion) {
    case "dueDate_asc":
      return { dueDate: { sort: "asc", nulls: "last" } };
    case "providerUpdatedAt_desc":
      return { providerUpdatedAt: { sort: "desc", nulls: "last" } };
    case "providerCreatedAt_desc":
      return { providerCreatedAt: { sort: "desc", nulls: "last" } };
  }
}

/**
 * Parses the `sortOrder` query parameter into an ordered list of Prisma `orderBy` entries.
 * Falls back to {@link DEFAULT_SORT_CRITERIA} if the parameter is missing or contains no valid values.
 * @param raw - Raw comma-separated string from the query parameter.
 * @returns An array of Prisma orderBy objects.
 */
function parseSortOrder(raw: string | null): PrismaOrderBy[] {
  if (!raw) return DEFAULT_SORT_CRITERIA.map(criterionToOrderBy);

  const criteria = raw
    .split(",")
    .map((v) => v.trim())
    .filter((v): v is SortCriterion => VALID_SORT_CRITERIA.includes(v as SortCriterion))
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, VALID_SORT_CRITERIA.length);

  if (criteria.length === 0) return DEFAULT_SORT_CRITERIA.map(criterionToOrderBy);
  return criteria.map(criterionToOrderBy);
}

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
  const orderBy = parseSortOrder(searchParams.get("sortOrder"));

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
      orderBy,
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
