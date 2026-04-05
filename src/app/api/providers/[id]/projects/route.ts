import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/api-response";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/db";
import { decrypt } from "@/lib/encryption/encryption";
import { createAdapter } from "@/services/issue-provider/factory";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/providers/[id]/projects — Lists external projects for a provider, annotated with registration status.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session) { return fail("UNAUTHORIZED", 401); }

  const { id } = await params;

  const provider = await prisma.issueProvider.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!provider) { return fail("FORBIDDEN", 403); }

  const decryptedCredentials = JSON.parse(decrypt(provider.encryptedCredentials));
  const credentials = { ...decryptedCredentials, ...(provider.baseUrl ? { baseUrl: provider.baseUrl } : {}) };
  const adapter = createAdapter(provider.type, credentials, provider.baseUrl);

  const externalProjects = await adapter.listProjects();

  const registeredProjects = await prisma.project.findMany({
    where: { issueProviderId: id },
    select: { externalId: true },
  });
  const registeredIds = new Set(registeredProjects.map((p) => p.externalId));

  const projects = externalProjects.map((p) => ({
    ...p,
    isRegistered: registeredIds.has(p.externalId),
  }));

  return ok(projects);
}
