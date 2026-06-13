/** API routes for listing and creating providers (GET, POST). */
import type { NextRequest } from "next/server";

import { ok, fail, failWithDetails } from "@/lib/api/api-response";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/db";
import { buildTypedCredentials } from "@/lib/encryption/credentials";
import { encrypt } from "@/lib/encryption/encryption";
import { createConnectionTestErrorDetails } from "@/lib/sync/error-utils";
import { isValidBaseUrl } from "@/lib/validation/base-url";
import { createAdapter, getProviderIconUrl } from "@/services/issue-provider/factory";
import { getAllProviders } from "@/services/issue-provider/registry";

/**
 * GET /api/providers — Returns all issue providers for the authenticated user.
 */
export async function GET() {
  const session = await auth();
  if (!session) { return fail("UNAUTHORIZED", 401); }

  let providers;
  try {
    providers = await prisma.issueProvider.findMany({
      where: { userId: session.user.id },
      select: { id: true, type: true, displayName: true, baseUrl: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  } catch (error) {
    console.error("[provider] Failed to list providers:", error instanceof Error ? error.message : String(error));
    return fail("INTERNAL_ERROR", 500);
  }

  return ok(providers.map((p) => ({ ...p, iconUrl: getProviderIconUrl(p.type) })));
}

type PostBody = {
  type: string;
  displayName: string;
  credentials: Record<string, string>;
};

/**
 * Validates the POST /api/providers request body shape.
 * @param body - The parsed JSON body to validate.
 * @returns The validated body, or `null` if the shape is invalid.
 */
function parsePostBody(body: unknown): PostBody | null {
  if (typeof body !== "object" || body === null) { return null; }
  const obj = body as Record<string, unknown>;
  if (!obj.type || typeof obj.type !== "string") { return null; }
  if (!obj.displayName || typeof obj.displayName !== "string") { return null; }
  const creds = obj.credentials;
  if (!creds || typeof creds !== "object" || Array.isArray(creds)) { return null; }
  const credsObj = creds as Record<string, unknown>;
  if (Object.values(credsObj).some((v) => typeof v !== "string")) { return null; }
  return { type: obj.type, displayName: obj.displayName, credentials: credsObj as Record<string, string> };
}

/**
 * POST /api/providers — Creates a new issue provider after verifying the connection.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) { return fail("UNAUTHORIZED", 401); }

  const rawBody = await req.json().catch(() => null);
  const parsed = parsePostBody(rawBody);
  if (!parsed) { return fail("INVALID_BODY", 400); }

  const { type, displayName, credentials } = parsed;

  if (!getAllProviders().some((m) => m.type === type)) {
    return fail("INVALID_PROVIDER_TYPE", 400);
  }

  // Extract and trim baseUrl from credentials (stored separately in DB, not encrypted)
  const { baseUrl: rawBaseUrl, ...credentialsWithoutUrl } = credentials as Record<string, string>;
  const baseUrl = rawBaseUrl?.trim() || undefined;

  // Validate baseUrl format if provided
  if (baseUrl && !isValidBaseUrl(baseUrl)) {
    return fail("INVALID_BASE_URL", 400);
  }

  // Test connection before saving (pass full credentials including baseUrl to adapter)
  try {
    const typedCredentials = buildTypedCredentials(type, credentials);
    const adapter = createAdapter(type, typedCredentials, baseUrl);
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
        type,
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
