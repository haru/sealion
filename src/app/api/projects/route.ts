import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api-response";
import { getProviderIconUrl } from "@/services/issue-provider/factory";

export async function GET() {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const projects = await prisma.project.findMany({
    where: { issueProvider: { userId: session.user.id } },
    select: {
      id: true,
      externalId: true,
      displayName: true,
      includeUnassigned: true,
      lastSyncedAt: true,
      syncError: true,
      issueProvider: {
        select: { id: true, displayName: true, type: true },
      },
    },
    orderBy: { displayName: "asc" },
  });

  return ok(projects.map((p) => ({
    ...p,
    issueProvider: { ...p.issueProvider, iconUrl: getProviderIconUrl(p.issueProvider.type) },
  })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const body = await req.json().catch(() => null);
  if (!body) return fail("INVALID_BODY", 400);

  const { issueProviderId, externalId, displayName } = body as {
    issueProviderId?: string;
    externalId?: string;
    displayName?: string;
  };

  if (!issueProviderId || !externalId || !displayName) {
    return fail("MISSING_FIELDS", 400);
  }

  const provider = await prisma.issueProvider.findFirst({
    where: { id: issueProviderId, userId: session.user.id },
  });
  if (!provider) return fail("FORBIDDEN", 403);

  const existing = await prisma.project.findFirst({
    where: { issueProviderId, externalId },
  });
  if (existing) return fail("CONFLICT", 409);

  const project = await prisma.project.create({
    data: { issueProviderId, externalId, displayName },
    select: {
      id: true,
      externalId: true,
      displayName: true,
      includeUnassigned: true,
      issueProvider: {
        select: { id: true, displayName: true, type: true },
      },
    },
  });

  return ok({
    ...project,
    issueProvider: { ...project.issueProvider, iconUrl: getProviderIconUrl(project.issueProvider.type) },
  }, 201);
}
