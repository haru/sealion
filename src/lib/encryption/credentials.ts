import { decrypt } from "@/lib/encryption/encryption";
import type { ProviderCredentials } from "@/services/issue-provider/factory";
import { getProviderMetadata } from "@/services/issue-provider/registry";

/**
 * Validates and converts a plain `Record<string, string>` of user-supplied credentials
 * into the typed {@link ProviderCredentials} expected by {@link createAdapter}.
 *
 * Use this in API route handlers when accepting raw credential input from the client
 * (e.g. during connection tests on POST/PATCH). The `baseUrl` field, if present inside
 * `raw`, is included in the validated output for Jira/Redmine.
 *
 * @param type - The provider type string used to look up the appropriate Zod schema.
 * @param raw - Raw credential fields as received from the request body.
 * @returns Typed, validated provider credentials.
 * @throws If required fields are missing, the shape does not match the provider type,
 *   or the type is not registered.
 */
export function buildTypedCredentials(
  type: string,
  raw: Record<string, string>,
): ProviderCredentials {
  const meta = getProviderMetadata(type);
  if (!meta) { throw new Error(`Unsupported provider type: ${type}`); }
  return meta.credentialSchema.parse(raw) as ProviderCredentials;
}

/**
 * Decrypts an encrypted credentials string, merges the optional `baseUrl`,
 * and validates the resulting shape against the provider-specific Zod schema.
 *
 * This centralises the decrypt-then-parse pattern used by API route handlers
 * and the sync service, replacing scattered `any`/`as never` casts with a
 * single, properly-typed and validated function.
 *
 * @param encryptedCredentials - The AES-256-GCM encrypted credentials string
 *   stored in `IssueProvider.encryptedCredentials`.
 * @param baseUrl - Optional base URL stored alongside the encrypted credentials
 *   (used by Jira, Redmine, and GitLab providers). Pass `null` or `undefined` to omit.
 * @param type - The provider type string used to look up the appropriate Zod schema.
 * @returns Typed provider credentials ready to pass to {@link createAdapter}.
 * @throws If decryption fails, the decrypted string is not valid JSON, the
 *   resulting credentials do not match the expected shape, or the type is not registered.
 */
export function decryptProviderCredentials(
  encryptedCredentials: string,
  baseUrl: string | null | undefined,
  type: string,
): ProviderCredentials {
  const meta = getProviderMetadata(type);
  if (!meta) { throw new Error(`Unsupported provider type: ${type}`); }

  const decrypted: Record<string, unknown> = JSON.parse(decrypt(encryptedCredentials));
  const merged = baseUrl ? { ...decrypted, baseUrl } : { ...decrypted };

  return meta.credentialSchema.parse(merged) as ProviderCredentials;
}
