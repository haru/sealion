import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";
import { IssueStatus } from "@prisma/client";
import { getProviderIconUrl } from "@/services/issue-provider/factory";

/**
 * GET /api/issues/today — Returns today's flagged open issues for the authenticated user.
 * @returns JSON response with `{ items: [...] }` or an error envelope.
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
