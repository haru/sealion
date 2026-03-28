import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";
import { getProviderIconUrl } from "@/services/issue-provider/factory";
import { VALID_SORT_CRITERIA, MAX_SORT_CRITERIA, SortCriterion } from "@/lib/types";
import { parseSearchQuery } from "@/lib/search-parser";

type PrismaOrderBy = Record<string, { sort: string; nulls?: string } | string>;

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

/** Deterministic tie-breaker appended to every sort to ensure stable pagination. */
const TIEBREAKER_ORDER_BY = { id: "asc" as const };

/** Pinned issues are always sorted to the top, ahead of any user-defined sort criteria. */
const PINNED_ORDER_BY: PrismaOrderBy = { pinned: "desc" };

/**
 * Parses the `sortOrder` query parameter into an ordered list of Prisma `orderBy` entries.
 * Falls back to {@link DEFAULT_SORT_CRITERIA} if the parameter is missing or contains no valid values.
 * Always prepends `{ pinned: 'desc' }` so pinned issues appear first regardless of other criteria.
 * Always appends a deterministic `id asc` tie-breaker to guarantee stable pagination.
 * @param raw - Raw comma-separated string from the query parameter.
 * @returns An array of Prisma orderBy objects starting with pinned and ending with the tie-breaker.
 */
function parseSortOrder(raw: string | null): PrismaOrderBy[] {
  if (!raw) {
    return [PINNED_ORDER_BY, ...DEFAULT_SORT_CRITERIA.map(criterionToOrderBy), TIEBREAKER_ORDER_BY];
  }

  const criteria = raw
    .split(",")
    .map((v) => v.trim())
    .filter((v): v is SortCriterion => VALID_SORT_CRITERIA.includes(v as SortCriterion))
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, MAX_SORT_CRITERIA);

  if (criteria.length === 0) {
    return [PINNED_ORDER_BY, ...DEFAULT_SORT_CRITERIA.map(criterionToOrderBy), TIEBREAKER_ORDER_BY];
  }
  return [PINNED_ORDER_BY, ...criteria.map(criterionToOrderBy), TIEBREAKER_ORDER_BY];
}

/**
 * Converts a date range preset string to a Prisma date filter for the given field.
 * @param field - The Prisma Issue field name to filter on.
 * @param preset - The date range preset string.
 * @returns A partial Prisma where object, or an empty object if the preset is unrecognised.
 */
function buildDateWhere(
  field: "dueDate" | "providerCreatedAt" | "providerUpdatedAt",
  preset: string
): Record<string, unknown> {
  const now = new Date();

  if (preset === "none") {
    // Only meaningful for dueDate
    return { [field]: null };
  }

  const start = new Date(now);
  const end = new Date(now);

  if (preset === "today") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { [field]: { gte: start, lte: end } };
  }

  if (preset === "thisWeek") {
    // Monday of current week to end of Sunday
    const dayOfWeek = now.getDay(); // 0 = Sunday
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    start.setDate(now.getDate() - daysToMonday);
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { [field]: { gte: start, lte: end } };
  }

  if (preset === "thisMonth") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(end.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { [field]: { gte: start, lte: end } };
  }

  if (preset === "past7days") {
    start.setDate(now.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    return { [field]: { gte: start } };
  }

  if (preset === "past30days") {
    start.setDate(now.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    return { [field]: { gte: start } };
  }

  if (preset === "pastYear") {
    start.setFullYear(now.getFullYear() - 1);
    start.setHours(0, 0, 0, 0);
    return { [field]: { gte: start } };
  }

  return {};
}

/**
 * GET /api/issues — Returns a paginated list of issues for the authenticated user.
 * Issues in the today list (todayFlag=true) are excluded — those are shown in the Today widget.
 * Supports optional search and filter parameters:
 *   - `q`: keyword search on issue title (space-separated OR, double-quote phrase)
 *   - `provider`: filter by provider type (GITHUB / JIRA / REDMINE)
 *   - `project`: filter by project display name (partial match)
 *   - `dueDateRange`: filter by due date preset (today / thisWeek / thisMonth / pastYear / none)
 *   - `createdRange`: filter by created date preset (today / past7days / past30days / pastYear)
 *   - `updatedRange`: filter by updated date preset (today / past7days / past30days / pastYear)
 *   - `assignee`: filter by assignee status (unassigned / assigned)
 * @param req - Supports query params: `page`, `limit`, `sortOrder`, and the search/filter params above.
 * @returns JSON response in the standard `{ data, error }` envelope where `data` is `{ items, total, totalToday, page, limit }` on success.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));
  const orderBy = parseSortOrder(searchParams.get("sortOrder"));

  // Search and filter params
  const rawQ = searchParams.get("q") ?? "";
  const provider = searchParams.get("provider") ?? undefined;
  const project = searchParams.get("project") ?? undefined;
  const dueDateRange = searchParams.get("dueDateRange") ?? undefined;
  const createdRange = searchParams.get("createdRange") ?? undefined;
  const updatedRange = searchParams.get("updatedRange") ?? undefined;
  const assignee = searchParams.get("assignee") ?? undefined;

  const parsed = parseSearchQuery(rawQ);

  // Build keyword conditions (OR per keyword, ANDed with filters)
  const keywordWhere =
    parsed.keywords.length > 0
      ? {
          OR: parsed.keywords.map((kw) => ({
            title: { contains: kw, mode: "insensitive" as const },
          })),
        }
      : {};

  // Build date filter conditions
  const dueDateWhere = dueDateRange ? buildDateWhere("dueDate", dueDateRange) : {};
  const createdWhere = createdRange ? buildDateWhere("providerCreatedAt", createdRange) : {};
  const updatedWhere = updatedRange ? buildDateWhere("providerUpdatedAt", updatedRange) : {};

  // Build provider+project nested filter
  const providerProjectWhere: Record<string, unknown> = {};
  if (provider || project) {
    const issueProviderWhere: Record<string, unknown> = {};
    if (provider) issueProviderWhere.type = provider;

    if (provider && project) {
      providerProjectWhere.project = {
        issueProvider: issueProviderWhere,
        displayName: { contains: project, mode: "insensitive" as const },
      };
    } else if (provider) {
      providerProjectWhere.project = { issueProvider: issueProviderWhere };
    } else if (project) {
      providerProjectWhere.project = {
        displayName: { contains: project, mode: "insensitive" as const },
      };
    }
  }

  // Assignee filter
  const assigneeWhere: Record<string, unknown> =
    assignee === "unassigned"
      ? { isUnassigned: true }
      : assignee === "assigned"
        ? { isUnassigned: false }
        : {};

  const baseWhere = {
    project: {
      issueProvider: { userId: session.user.id },
    },
  };

  const filterWhere = {
    ...keywordWhere,
    ...dueDateWhere,
    ...createdWhere,
    ...updatedWhere,
    ...assigneeWhere,
    ...providerProjectWhere,
  };

  const regularWhere = {
    ...baseWhere,
    // Exclude issues in today's list — those are shown in the Today widget instead.
    todayFlag: { not: true },
    ...filterWhere,
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
        pinned: true,
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
