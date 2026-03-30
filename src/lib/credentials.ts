import { decrypt } from "@/lib/encryption";
import type { ProviderCredentials } from "@/services/issue-provider/factory";

/**
 * Decrypts an encrypted credentials string and merges the optional `baseUrl`.
 *
 * This centralises the decrypt-then-parse pattern used by API route handlers
 * and the sync service, replacing scattered `any`/`as never` casts with a
 * single, properly-typed function.
 *
 * @param encryptedCredentials - The AES-256-GCM encrypted credentials string
 *   stored in `IssueProvider.encryptedCredentials`.
 * @param baseUrl - Optional base URL stored alongside the encrypted credentials
 *   (used by Jira and Redmine providers). Pass `null` or `undefined` to omit.
 * @returns Typed provider credentials ready to pass to {@link createAdapter}.
 * @throws If decryption fails or the decrypted string is not valid JSON.
 */
export function decryptProviderCredentials(
  encryptedCredentials: string,
  baseUrl?: string | null,
): ProviderCredentials {
  const decrypted: Record<string, unknown> = JSON.parse(decrypt(encryptedCredentials));
  const credentials = baseUrl
    ? { ...decrypted, baseUrl }
    : { ...decrypted };
  return credentials as ProviderCredentials;
}
