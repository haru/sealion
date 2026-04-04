import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { decryptProviderCredentials } from "@/lib/credentials";
import { prisma } from "@/lib/db";
import { extractAxiosStatus } from "@/lib/error-utils";
import { createAdapter } from "@/services/issue-provider/factory";

type Params = { params: Promise<{ id: string }> };

/**
 * Closes an issue on the external provider, posts an optional comment, then deletes it from the local DB.
 * All issues in the local DB are open by invariant, so closure always means deletion.
 * @param id - Internal issue ID.
 * @param userId - ID of the authenticated user (for ownership check).
 * @param comment - Optional comment to post to the provider before deleting.
 */
async function handleCloseIssue(id: string, userId: string, comment?: string) {
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
            select: { type: true, encryptedCredentials: true, baseUrl: true, userId: true },
          },
        },
      },
    },
  });

  if (!issue) { return fail("FORBIDDEN", 403); }

  let credentials;
  try {
    credentials = decryptProviderCredentials(
      issue.project.issueProvider.encryptedCredentials,
      issue.project.issueProvider.baseUrl,
      issue.project.issueProvider.type,
    );
  } catch {
    return fail("INVALID_CREDENTIALS", 400);
  }
  const adapter = createAdapter(issue.project.issueProvider.type, credentials, issue.project.issueProvider.baseUrl);

  try {
    await adapter.closeIssue(issue.project.externalId, issue.externalId);
    if (comment && comment.trim()) {
      await adapter.addComment(issue.project.externalId, issue.externalId, comment.trim());
    }
  } catch (err) {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else if (typeof err === "string") {
      message = err;
    } else {
      message = "Unknown error";
    }
    // Best-effort HTTP status extraction (e.g., from AxiosError) without logging headers or URLs.
    const status = extractAxiosStatus(err);
    // Avoid logging the raw error object to prevent leaking sensitive data (e.g., Authorization headers).
    // Log only sanitized, non-sensitive context for debugging.
    console.error("[closeIssue] External provider call failed", {
      providerType: issue.project.issueProvider.type,
      projectExternalId: issue.project.externalId,
      issueExternalId: issue.externalId,
      message,
      status,
    });
    return fail("EXTERNAL_UPDATE_FAILED", 502);
  }

  // Use deleteMany so that a concurrent close request (which already deleted the record)
  // produces a graceful 404 rather than an unhandled Prisma P2025 error.
  const { count } = await prisma.issue.deleteMany({ where: { id } });
  if (count === 0) { return fail("NOT_FOUND", 404); }

  return ok({ id });
}

/**
 * Sets or clears the pinned flag on an issue.
 * @param id - Internal issue ID.
 * @param pinned - Whether to pin or unpin the issue.
 * @param userId - ID of the authenticated user (for ownership check).
 * @returns 200 with `{ id, pinned }` on success, 403 if issue not found or not owned by user.
 */
async function handlePinnedToggle(id: string, pinned: boolean, userId: string) {
  const issue = await prisma.issue.findFirst({
    where: {
      id,
      project: { issueProvider: { userId } },
    },
    select: { id: true },
  });

  if (!issue) { return fail("FORBIDDEN", 403); }

  try {
    const updated = await prisma.issue.update({
      where: { id },
      data: { pinned },
      select: { id: true, pinned: true },
    });

    return ok(updated);
  } catch (err) {
    // Handle concurrent deletion (P2025) gracefully.
    const isRecordNotFound =
      typeof err === "object" &&
      err !== null &&
      (err as { code?: string }).code === "P2025";
    if (isRecordNotFound) { return fail("NOT_FOUND", 404); }
    throw err;
  }
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
    select: { id: true, todayFlag: true, todayOrder: true, todayAddedAt: true },
  });

  if (!issue) { return fail("FORBIDDEN", 403); }

  if (todayFlag) {
    // Idempotency: already flagged — return current state without corrupting todayOrder
    if (issue.todayFlag) {
      return ok({ id: issue.id, todayFlag: issue.todayFlag, todayOrder: issue.todayOrder, todayAddedAt: issue.todayAddedAt });
    }

    // Use Serializable isolation so that concurrent flag requests cannot
    // read the same count and assign duplicate todayOrder values.
    const updated = await prisma.$transaction(
      async (tx) => {
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
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

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
 * PATCH /api/issues/[id] — Closes or updates the today flag or pinned state of an issue.
 * - `{ closed: true, comment?: string }` — closes the issue on the provider and deletes it locally.
 * - `{ todayFlag: boolean }` — sets or clears the today flag.
 * - `{ pinned: boolean }` — sets or clears the pinned flag.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) { return fail("UNAUTHORIZED", 401); }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) { return fail("INVALID_BODY", 400); }

  if ("pinned" in body) {
    if (typeof body.pinned !== "boolean") { return fail("INVALID_INPUT", 400); }
    return handlePinnedToggle(id, body.pinned as boolean, session.user.id);
  }

  if ("todayFlag" in body) {
    if (typeof body.todayFlag !== "boolean") { return fail("INVALID_INPUT", 400); }
    return handleTodayFlagUpdate(id, body.todayFlag as boolean, session.user.id);
  }

  if ("closed" in body) {
    if (body.closed !== true) { return fail("INVALID_INPUT", 400); }
    const comment = typeof body.comment === "string" ? body.comment : undefined;
    return handleCloseIssue(id, session.user.id, comment);
  }

  return fail("INVALID_BODY", 400);
}
