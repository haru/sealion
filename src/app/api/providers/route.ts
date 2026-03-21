import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { ok, fail } from "@/lib/api-response";
import { createAdapter, getProviderIconUrl } from "@/services/issue-provider/factory";
import { ProviderType } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const providers = await prisma.issueProvider.findMany({
    where: { userId: session.user.id },
    select: { id: true, type: true, displayName: true, baseUrl: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return ok(providers.map((p) => ({ ...p, iconUrl: getProviderIconUrl(p.type) })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const body = await req.json().catch(() => null);
  if (!body) return fail("INVALID_BODY", 400);

  const { type, displayName, credentials } = body as {
    type: string;
    displayName: string;
    credentials: Record<string, string>;
  };

  if (!type || !displayName || !credentials) {
    return fail("MISSING_FIELDS", 400);
  }

  if (!Object.values(ProviderType).includes(type as ProviderType)) {
    return fail("INVALID_PROVIDER_TYPE", 400);
  }

  // Extract baseUrl from credentials for Jira/Redmine (stored separately in DB)
  const { baseUrl, ...credentialsWithoutUrl } = credentials as Record<string, string>;

  // Test connection before saving (pass full credentials including baseUrl to adapter)
  try {
    const adapter = createAdapter(type as ProviderType, credentials as never);
    await adapter.testConnection();
  } catch {
    return fail("CONNECTION_TEST_FAILED", 422);
  }

  const encryptedCredentials = encrypt(JSON.stringify(credentialsWithoutUrl));

  const provider = await prisma.issueProvider.create({
    data: {
      type: type as ProviderType,
      displayName,
      encryptedCredentials,
      ...(baseUrl ? { baseUrl } : {}),
      userId: session.user.id,
    },
    select: { id: true, type: true, displayName: true, baseUrl: true, createdAt: true },
  });

  return ok({ ...provider, iconUrl: getProviderIconUrl(provider.type) }, 201);
}
