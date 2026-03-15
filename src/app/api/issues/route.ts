import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";
import { IssueStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));
  const statusParam = searchParams.get("status");

  const statusFilter =
    statusParam && Object.values(IssueStatus).includes(statusParam as IssueStatus)
      ? (statusParam as IssueStatus)
      : undefined;

  const where = {
    project: {
      issueProvider: { userId: session.user.id },
    },
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.issue.count({ where }),
    prisma.issue.findMany({
      where,
      orderBy: [
        { status: "asc" },      // OPEN sorts before CLOSED (enum definition order)
        { dueDate: "asc" },     // nulls last
        { priority: "desc" },   // CRITICAL > HIGH > MEDIUM > LOW
      ],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        externalId: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        externalUrl: true,
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

  return ok({ items, total, page, limit });
}
