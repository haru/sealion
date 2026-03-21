import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { ok, fail } from "@/lib/api-response";
import { createAdapter } from "@/services/issue-provider/factory";
import { IssueStatus } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

/**
 * Updates the status of an issue and syncs the change to the external provider.
 * @param id - Internal issue ID.
 * @param status - Target status as a string, validated and coerced to {@link IssueStatus}.
 * @param userId - ID of the authenticated user (for ownership check).
 */
async function handleStatusUpdate(
  id: string,
  status: string,
  userId: string
) {
  if (!Object.values(IssueStatus).includes(status as IssueStatus)) {
    return fail("INVALID_STATUS", 400);
  }

  const issue = await prisma.issue.findFirst({
    where: {
      id,
      project: { issueProvider: { userId } },
    },
    include: {
      project: {
        select: {
          id: true,
          externalId: true,
          issueProvider: {
            select: { type: true, encryptedCredentials: true, userId: true },
          },
        },
      },
    },
  });

  if (!issue) return fail("FORBIDDEN", 403);

  const credentials = JSON.parse(decrypt(issue.project.issueProvider.encryptedCredentials));
  const adapter = createAdapter(issue.project.issueProvider.type as never, credentials);

  try {
    if (status === IssueStatus.CLOSED) {
      await adapter.closeIssue(issue.project.externalId, issue.externalId);
    } else {
      await adapter.reopenIssue(issue.project.externalId, issue.externalId);
    }
  } catch {
    return fail("EXTERNAL_UPDATE_FAILED", 502);
  }

  const updateData: { status: IssueStatus; todayFlag?: boolean; todayOrder?: null; todayAddedAt?: null } = {
    status: status as IssueStatus,
  };
  if (status === IssueStatus.CLOSED) {
    updateData.todayFlag = false;
    updateData.todayOrder = null;
    updateData.todayAddedAt = null;
  }

  const updated = await prisma.issue.update({
    where: { id },
    data: updateData,
    select: { id: true, status: true },
  });

  return ok(updated);
}

/**
 * Sets or clears the today flag on an issue, assigning an order position when flagging.
 * @param id - Internal issue ID.
 * @param todayFlag - Whether to add or remove the issue from today's list.
 * @param userId - ID of the authenticated user (for ownership check).
 */
async function handleTodayFlagUpdate(id: string, todayFlag: boolean, userId: string) {
  const issue = await prisma.issue.findFirst({
    where: {
      id,
      project: { issueProvider: { userId } },
    },
    select: { id: true, status: true, todayFlag: true },
  });

  if (!issue) return fail("FORBIDDEN", 403);

  if (todayFlag && issue.status !== IssueStatus.OPEN) {
    return fail("ISSUE_NOT_OPEN", 400);
  }

  if (todayFlag) {
    const updated = await prisma.$transaction(async (tx) => {
      const todayCount = await tx.issue.count({
        where: {
          todayFlag: true,
          project: { issueProvider: { userId } },
        },
      });
      return tx.issue.update({
        where: { id },
        data: {
          todayFlag: true,
          todayOrder: todayCount + 1,
          todayAddedAt: new Date(),
        },
        select: { id: true, todayFlag: true, todayOrder: true, todayAddedAt: true },
      });
    });

    return ok(updated);
  }

  const updated = await prisma.issue.update({
    where: { id },
    data: { todayFlag: false, todayOrder: null, todayAddedAt: null },
    select: { id: true, todayFlag: true, todayOrder: true, todayAddedAt: true },
  });

  return ok(updated);
}

/**
 * PATCH /api/issues/[id] — Updates the status or today flag of an issue.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return fail("INVALID_BODY", 400);

  if ("todayFlag" in body) {
    if (typeof body.todayFlag !== "boolean") return fail("INVALID_INPUT", 400);
    return handleTodayFlagUpdate(id, body.todayFlag as boolean, session.user.id);
  }

  if ("status" in body) {
    return handleStatusUpdate(id, body.status as string, session.user.id);
  }

  return fail("INVALID_BODY", 400);
}
