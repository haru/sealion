import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { ok, fail } from "@/lib/api-response";
import { createAdapter } from "@/services/issue-provider/factory";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const { id } = await params;

  const provider = await prisma.issueProvider.findFirst({
    where: { id, userId: session.user.id },
    include: { projects: { select: { externalId: true, isEnabled: true } } },
  });

  if (!provider) return fail("FORBIDDEN", 403);

  const credentials = JSON.parse(decrypt(provider.encryptedCredentials));
  const adapter = createAdapter(provider.type, credentials);

  const externalProjects = await adapter.listProjects();
  const enabledIds = new Set(
    provider.projects.filter((p) => p.isEnabled).map((p) => p.externalId)
  );

  const projects = externalProjects.map((p) => ({
    ...p,
    isEnabled: enabledIds.has(p.externalId),
  }));

  return ok(projects);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const { id } = await params;

  const provider = await prisma.issueProvider.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!provider) return fail("FORBIDDEN", 403);

  const body = await req.json().catch(() => null);
  if (!body) return fail("INVALID_BODY", 400);

  const { projects } = body as {
    projects: { externalId: string; displayName: string; isEnabled: boolean }[];
  };

  if (!Array.isArray(projects)) return fail("INVALID_BODY", 400);

  // Upsert each project
  await Promise.all(
    projects.map((p) =>
      prisma.project.upsert({
        where: { issueProviderId_externalId: { issueProviderId: id, externalId: p.externalId } },
        update: { isEnabled: p.isEnabled, displayName: p.displayName },
        create: {
          issueProviderId: id,
          externalId: p.externalId,
          displayName: p.displayName,
          isEnabled: p.isEnabled,
        },
      })
    )
  );

  return ok({ updated: projects.length });
}
