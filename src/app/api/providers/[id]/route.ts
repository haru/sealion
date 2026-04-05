import type { NextRequest } from "next/server";

import { ok, fail, failWithDetails } from "@/lib/api-response";
import { auth } from "@/lib/auth";
import { buildTypedCredentials } from "@/lib/credentials";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import { createConnectionTestErrorDetails } from "@/lib/error-utils";
import { createAdapter, getProviderIconUrl } from "@/services/issue-provider/factory";
import { getProviderMetadata } from "@/services/issue-provider/registry";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Validates that all required credential fields (from registry metadata) are present.
 * @param type - The provider type string.
 * @param credentials - Credential fields from the request body.
 * @returns `true` if all required fields are present, `false` otherwise.
 */
function hasRequiredCredentialFields(
  type: string,
  credentials: Record<string, string>,
): boolean {
  const meta = getProviderMetadata(type);
  if (!meta) { return false; }
  return meta.credentialFields.every((field) => !field.required || Boolean(credentials[field.key]));
}

/** Result of resolving effective credentials for a provider update. */
type CredentialResult = {
  encryptedToStore: string | undefined;
  effectiveCredentials: Record<string, string>;
};

/**
 * Resolves the effective credentials to use for a provider update and connection test.
 * When `changeCredentials` is true, validates and encrypts new credentials.
 * When false, decrypts the existing credentials from the database.
 *
 * @param provider - The existing provider record.
 * @param changeCredentials - Whether new credentials are being submitted.
 * @param credentials - New credential fields (required when changeCredentials is true).
 * @param baseUrl - The new base URL, if any.
 * @returns A {@link CredentialResult} on success, or a `Response` error to return immediately.
 */
function resolveCredentials(
  provider: { type: string; encryptedCredentials: string; baseUrl: string | null; id: string },
  changeCredentials: boolean,
  credentials: Record<string, string> | undefined,
  baseUrl: string | undefined,
): CredentialResult | Response {
  if (changeCredentials) {
    if (!credentials) { return fail("MISSING_FIELDS", 400); }
    if (!hasRequiredCredentialFields(provider.type, credentials)) { return fail("MISSING_FIELDS", 400); }

    const effectiveCredentials = { ...credentials, ...(baseUrl ? { baseUrl } : {}) };
    const credentialsWithoutUrl = Object.fromEntries(
      Object.entries(credentials).filter(([key]) => key !== "baseUrl"),
    );
    try {
      return { encryptedToStore: encrypt(JSON.stringify(credentialsWithoutUrl)), effectiveCredentials };
    } catch (error) {
      console.error("[provider] Failed to encrypt credentials:", error instanceof Error ? error.message : String(error));
      return fail("INTERNAL_ERROR", 500);
    }
  }

  let existingCreds: Record<string, string>;
  try {
    existingCreds = JSON.parse(decrypt(provider.encryptedCredentials)) as Record<string, string>;
  } catch {
    console.error("[provider] Failed to decrypt existing credentials for provider", provider.id);
    return fail("CREDENTIALS_DECRYPT_FAILED", 500);
  }
  const effectiveBaseUrl = baseUrl ?? provider.baseUrl ?? null;
  return {
    encryptedToStore: undefined,
    effectiveCredentials: { ...existingCreds, ...(effectiveBaseUrl ? { baseUrl: effectiveBaseUrl } : {}) },
  };
}

/**
 * DELETE /api/providers/[id] — Deletes an issue provider owned by the authenticated user.
 */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session) { return fail("UNAUTHORIZED", 401); }

  const { id } = await params;

  // Verify ownership
  const provider = await prisma.issueProvider.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!provider) { return fail("FORBIDDEN", 403); }

  await prisma.issueProvider.delete({ where: { id } });

  return ok({ id });
}

/**
 * PATCH /api/providers/[id] — Updates a provider's display name, base URL, or credentials.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session) { return fail("UNAUTHORIZED", 401); }

  const { id } = await params;

  const provider = await prisma.issueProvider.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!provider) { return fail("FORBIDDEN", 403); }

  const body = await req.json().catch(() => null);
  if (!body) { return fail("INVALID_BODY", 400); }

  const { displayName, baseUrl: rawBaseUrl, changeCredentials, credentials } = body as {
    displayName: string;
    baseUrl?: string;
    changeCredentials: boolean;
    credentials?: Record<string, string>;
  };

  const metadata = getProviderMetadata(provider.type);
  const baseUrl = (metadata?.baseUrlMode === "optional" && rawBaseUrl?.trim() === "")
    ? undefined
    : rawBaseUrl;

  // Validate displayName
  if (!displayName) { return fail("MISSING_FIELDS", 400); }

  // Validate baseUrl for providers that require it
  if (metadata?.baseUrlMode === "required" && !baseUrl) { return fail("MISSING_FIELDS", 400); }

  // Determine the effective credentials for connection test
  const credResult = resolveCredentials(provider, changeCredentials, credentials, baseUrl);
  if (credResult instanceof Response) { return credResult; }
  const { encryptedToStore, effectiveCredentials } = credResult;

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
