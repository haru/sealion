import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";
import { IssueStatus } from "@prisma/client";
import { getProviderIconUrl } from "@/services/issue-provider/factory";

/**
 * GET /api/issues/today — Returns today's flagged open issues for the authenticated user.
 *
 * Issues appear here when their `todayFlag` has been set to `true` via
 * `PATCH /api/issues/[id]` with `{ todayFlag: true }`.
 * To remove an issue from today's list, send `PATCH /api/issues/[id]` with `{ todayFlag: false }`.
 *
 * @returns JSON response using the standard envelope: `{ data: { items: [...] }, error: null }` on success or `{ data: null, error: string }` on failure.
 */
export async function GET() {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const items = await prisma.issue.findMany({
    where: {
      todayFlag: true,
      status: IssueStatus.OPEN,
      project: {
        issueProvider: { userId: session.user.id },
      },
    },
    orderBy: [{ todayOrder: "asc" }],
    select: {
      id: true,
      externalId: true,
      title: true,
      status: true,
      priority: true,
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
  });

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

  return ok({ items: itemsWithIconUrl });
}
