import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { ok, fail } from "@/lib/api-response";
import { createAdapter } from "@/services/issue-provider/factory";
import { IssueStatus } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return fail("INVALID_BODY", 400);

  const { status } = body as { status: string };
  if (!status || !Object.values(IssueStatus).includes(status as IssueStatus)) {
    return fail("INVALID_STATUS", 400);
  }

  // Verify ownership via provider's userId
  const issue = await prisma.issue.findFirst({
    where: {
      id,
      project: { issueProvider: { userId: session.user.id } },
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

  // External service update must succeed before DB update
  try {
    if (status === IssueStatus.CLOSED) {
      await adapter.closeIssue(issue.project.externalId, issue.externalId);
    } else {
      await adapter.reopenIssue(issue.project.externalId, issue.externalId);
    }
  } catch {
    return fail("EXTERNAL_UPDATE_FAILED", 502);
  }

  const updated = await prisma.issue.update({
    where: { id },
    data: { status: status as IssueStatus },
    select: { id: true, status: true },
  });

  return ok(updated);
}
