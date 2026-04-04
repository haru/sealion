import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { buildDateWhere } from "@/lib/date-where";
import { prisma } from "@/lib/db";
import { parseSearchQuery } from "@/lib/search-parser";
import { VALID_SORT_CRITERIA, MAX_SORT_CRITERIA, type SortCriterion } from "@/lib/types";
import { getProviderIconUrl } from "@/services/issue-provider/factory";

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
 * Builds the Prisma where clause fragment for provider and project filtering.
 * @param userId - Authenticated user's ID.
 * @param effectiveProvider - Provider type filter, or undefined.
 * @param effectiveProject - Project display name filter, or undefined.
 * @returns Prisma where condition fragment.
 */
function buildProviderProjectWhere(
  userId: string,
  effectiveProvider: string | undefined,
  effectiveProject: string | undefined,
): Record<string, unknown> {
  if (!effectiveProvider && !effectiveProject) { return {}; }
  const issueProviderWhere: Record<string, unknown> = { userId };
  if (effectiveProvider) { issueProviderWhere.type = effectiveProvider; }
  if (effectiveProvider && effectiveProject) {
    return {
      project: {
        issueProvider: issueProviderWhere,
        displayName: { contains: effectiveProject, mode: "insensitive" as const },
      },
    };
  }
  if (effectiveProvider) { return { project: { issueProvider: issueProviderWhere } }; }
  return {
    project: {
      issueProvider: { userId },
      displayName: { contains: effectiveProject, mode: "insensitive" as const },
    },
  };
}

/**
 * Builds the Prisma where clause fragment for assignee filtering.
 * @param effectiveAssignee - Assignee filter value, or undefined.
 * @returns Prisma where condition fragment.
 */
function buildAssigneeWhere(effectiveAssignee: string | undefined): Record<string, unknown> {
  if (effectiveAssignee === "unassigned") { return { isUnassigned: true }; }
  if (effectiveAssignee === "assigned") { return { isUnassigned: false }; }
  return {};
}

/**
 * GET /api/issues — Returns a paginated list of issues for the authenticated user.
 * Issues in the today list (todayFlag=true) are excluded — those are shown in the Today widget.
 * Supports optional search and filter parameters:
 *   - `q`: keyword search on issue title (space-separated OR, double-quote phrase).
 *     Also supports embedded filter tokens (`provider:GITHUB`, `assignee:unassigned`,
 *     `dueDate:today`, `createdDate:past7days`, `updatedDate:past30days`, `project:name`)
 *     which are applied as fallbacks when the corresponding explicit query params are absent.
 *     Explicit query params always take precedence over embedded tokens in `q`.
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
  if (!session) { return fail("UNAUTHORIZED", 401); }

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

  // Explicit query params take precedence over filters parsed from q
  const effectiveProvider = provider ?? parsed.provider;
  const effectiveProject = project ?? parsed.project;
  const effectiveDueDateRange = dueDateRange ?? parsed.dueDateFilter?.preset;
  const effectiveCreatedRange = createdRange ?? parsed.createdFilter?.preset;
  const effectiveUpdatedRange = updatedRange ?? parsed.updatedFilter?.preset;
  const effectiveAssignee = assignee ?? parsed.assignee;

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
  const dueDateWhere = effectiveDueDateRange ? buildDateWhere("dueDate", effectiveDueDateRange) : {};
  const createdWhere = effectiveCreatedRange ? buildDateWhere("providerCreatedAt", effectiveCreatedRange) : {};
  const updatedWhere = effectiveUpdatedRange ? buildDateWhere("providerUpdatedAt", effectiveUpdatedRange) : {};

  // Build provider+project nested filter
  const providerProjectWhere = buildProviderProjectWhere(
    session.user.id,
    effectiveProvider,
    effectiveProject,
  );

  // Assignee filter
  const assigneeWhere = buildAssigneeWhere(effectiveAssignee);

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

  const fetchResult = await Promise.all([
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
  ]).catch((error: unknown) => {
    console.error("[issues] Failed to fetch issues:", error instanceof Error ? error.message : String(error));
    return null;
  });

  if (!fetchResult) { return fail("INTERNAL_ERROR", 500); }

  const [total, totalToday, items] = fetchResult;

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
