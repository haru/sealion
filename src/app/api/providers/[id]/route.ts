import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import { ok, fail, failWithDetails } from "@/lib/api-response";
import { createAdapter, getProviderIconUrl } from "@/services/issue-provider/factory";
import { ProviderType } from "@prisma/client";
import { createConnectionTestErrorDetails } from "@/lib/error-utils";
import { buildTypedCredentials } from "@/lib/credentials";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/providers/[id] — Deletes an issue provider owned by the authenticated user.
 */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const { id } = await params;

  // Verify ownership
  const provider = await prisma.issueProvider.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!provider) return fail("FORBIDDEN", 403);

  await prisma.issueProvider.delete({ where: { id } });

  return ok({ id });
}

/**
 * PATCH /api/providers/[id] — Updates a provider's display name, base URL, or credentials.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session) return fail("UNAUTHORIZED", 401);

  const { id } = await params;

  const provider = await prisma.issueProvider.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!provider) return fail("FORBIDDEN", 403);

  const body = await req.json().catch(() => null);
  if (!body) return fail("INVALID_BODY", 400);

  const { displayName, baseUrl, changeCredentials, credentials } = body as {
    displayName: string;
    baseUrl?: string;
    changeCredentials: boolean;
    credentials?: Record<string, string>;
  };

  // Validate displayName
  if (!displayName) return fail("MISSING_FIELDS", 400);

  // Validate baseUrl for Jira/Redmine
  const requiresBaseUrl = provider.type === ProviderType.JIRA || provider.type === ProviderType.REDMINE;
  if (requiresBaseUrl && !baseUrl) return fail("MISSING_FIELDS", 400);

  // Determine the effective credentials for connection test
  let encryptedToStore: string | undefined;
  let effectiveCredentials: Record<string, string>;

  if (changeCredentials) {
    if (!credentials) return fail("MISSING_FIELDS", 400);
    // Validate provider-specific required fields
    if (provider.type === ProviderType.GITHUB && !credentials.token) return fail("MISSING_FIELDS", 400);
    if (provider.type === ProviderType.JIRA && (!credentials.email || !credentials.apiToken)) return fail("MISSING_FIELDS", 400);
    if (provider.type === ProviderType.REDMINE && !credentials.apiKey) return fail("MISSING_FIELDS", 400);

    effectiveCredentials = { ...credentials, ...(baseUrl ? { baseUrl } : {}) };
    // Strip baseUrl from credentials before encrypting (stored separately in DB column)
    const credentialsWithoutUrl = Object.fromEntries(
      Object.entries(credentials).filter(([key]) => key !== "baseUrl")
    );
    try {
      encryptedToStore = encrypt(JSON.stringify(credentialsWithoutUrl));
    } catch (error) {
      console.error("[provider] Failed to encrypt credentials:", error instanceof Error ? error.message : String(error));
      return fail("INTERNAL_ERROR", 500);
    }
  } else {
    let existingCreds: Record<string, string>;
    try {
      existingCreds = JSON.parse(decrypt(provider.encryptedCredentials));
    } catch {
      console.error("[provider] Failed to decrypt existing credentials for provider", id);
      return fail("CREDENTIALS_DECRYPT_FAILED", 500);
    }
    effectiveCredentials = { ...existingCreds, ...(baseUrl ? { baseUrl } : provider.baseUrl ? { baseUrl: provider.baseUrl } : {}) };
  }

  // Test connection
  try {
    const typedCredentials = buildTypedCredentials(provider.type, effectiveCredentials);
    const adapter = createAdapter(provider.type, typedCredentials, baseUrl || provider.baseUrl);
    await adapter.testConnection();
  } catch (error) {
    console.error("[provider] Connection test failed:", error instanceof Error ? error.message : String(error));
    const errorDetails = createConnectionTestErrorDetails(error);
    return failWithDetails("CONNECTION_TEST_FAILED", errorDetails, 422);
  }

  let updated;
  try {
    updated = await prisma.issueProvider.update({
      where: { id },
      data: {
        displayName,
        ...(baseUrl !== undefined ? { baseUrl } : {}),
        ...(encryptedToStore ? { encryptedCredentials: encryptedToStore } : {}),
      },
      select: { id: true, type: true, displayName: true, baseUrl: true, createdAt: true },
    });
  } catch (error) {
    console.error("[provider] Failed to update provider:", error instanceof Error ? error.message : String(error));
    return fail("INTERNAL_ERROR", 500);
  }

  return ok({ ...updated, iconUrl: getProviderIconUrl(updated.type) });
}
