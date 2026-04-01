import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { ok, fail, failWithDetails } from "@/lib/api-response";
import { createAdapter, getProviderIconUrl } from "@/services/issue-provider/factory";
import { ProviderType } from "@prisma/client";
import { createConnectionTestErrorDetails } from "@/lib/error-utils";
import { buildTypedCredentials } from "@/lib/credentials";

/**
 * GET /api/providers — Returns all issue providers for the authenticated user.
 */
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

/**
 * POST /api/providers — Creates a new issue provider after verifying the connection.
 */
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
    const typedCredentials = buildTypedCredentials(type as ProviderType, credentials);
    const adapter = createAdapter(type as ProviderType, typedCredentials, baseUrl);
    await adapter.testConnection();
  } catch (error) {
    console.error("[provider] Connection test failed:", error instanceof Error ? error.message : String(error));
    const errorDetails = createConnectionTestErrorDetails(error);
    return failWithDetails("CONNECTION_TEST_FAILED", errorDetails, 422);
  }

  let encryptedCredentials: string;
  try {
    encryptedCredentials = encrypt(JSON.stringify(credentialsWithoutUrl));
  } catch (error) {
    console.error("[provider] Failed to encrypt credentials:", error instanceof Error ? error.message : String(error));
    return fail("INTERNAL_ERROR", 500);
  }

  let provider;
  try {
    provider = await prisma.issueProvider.create({
      data: {
        type: type as ProviderType,
        displayName,
        encryptedCredentials,
        ...(baseUrl ? { baseUrl } : {}),
        userId: session.user.id,
      },
      select: { id: true, type: true, displayName: true, baseUrl: true, createdAt: true },
    });
  } catch (error) {
    console.error("[provider] Failed to create provider:", error instanceof Error ? error.message : String(error));
    return fail("INTERNAL_ERROR", 500);
  }

  return ok({ ...provider, iconUrl: getProviderIconUrl(provider.type) }, 201);
}
