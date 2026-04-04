import { ProviderType } from "@prisma/client";
import { z } from "zod";

import { decrypt } from "@/lib/encryption";
import type {
  GitHubCredentials,
  GitLabCredentials,
  JiraCredentials,
  ProviderCredentials,
  RedmineCredentials,
} from "@/services/issue-provider/factory";

/** Zod schema for GitHub credentials. */
const githubCredentialsSchema = z.object({
  token: z.string().min(1),
}) satisfies z.ZodType<GitHubCredentials>;

/** Zod schema for Jira credentials (baseUrl is merged in before validation). */
const jiraCredentialsSchema = z.object({
  baseUrl: z.string().min(1),
  email: z.string().min(1),
  apiToken: z.string().min(1),
}) satisfies z.ZodType<JiraCredentials>;

/** Zod schema for Redmine credentials (baseUrl is merged in before validation). */
const redmineCredentialsSchema = z.object({
  baseUrl: z.string().min(1),
  apiKey: z.string().min(1),
}) satisfies z.ZodType<RedmineCredentials>;

/** Zod schema for GitLab credentials. */
const gitlabCredentialsSchema = z.object({
  token: z.string().min(1),
}) satisfies z.ZodType<GitLabCredentials>;

/**
 * Validates and converts a plain `Record<string, string>` of user-supplied credentials
 * into the typed {@link ProviderCredentials} expected by {@link createAdapter}.
 *
 * Use this in API route handlers when accepting raw credential input from the client
 * (e.g. during connection tests on POST/PATCH). The `baseUrl` field, if present inside
 * `raw`, is included in the validated output for Jira/Redmine.
 *
 * @param type - The provider type used to select the appropriate Zod schema.
 * @param raw - Raw credential fields as received from the request body.
 * @returns Typed, validated provider credentials.
 * @throws If required fields are missing or the shape does not match the provider type.
 */
export function buildTypedCredentials(
  type: ProviderType,
  raw: Record<string, string>,
): ProviderCredentials {
  switch (type) {
    case ProviderType.GITHUB:
      return githubCredentialsSchema.parse(raw);
    case ProviderType.JIRA:
      return jiraCredentialsSchema.parse(raw);
    case ProviderType.REDMINE:
      return redmineCredentialsSchema.parse(raw);
    case ProviderType.GITLAB:
      return gitlabCredentialsSchema.parse(raw);
    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
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
 * @param type - The provider type used to select the appropriate Zod schema for
 *   shape validation.
 * @returns Typed provider credentials ready to pass to {@link createAdapter}.
 * @throws If decryption fails, the decrypted string is not valid JSON, or the
 *   resulting credentials do not match the expected shape for the given provider.
 */
export function decryptProviderCredentials(
  encryptedCredentials: string,
  baseUrl: string | null | undefined,
  type: ProviderType,
): ProviderCredentials {
  const decrypted: Record<string, unknown> = JSON.parse(decrypt(encryptedCredentials));
  const merged = baseUrl ? { ...decrypted, baseUrl } : { ...decrypted };

  switch (type) {
    case ProviderType.GITHUB:
      return githubCredentialsSchema.parse(merged);
    case ProviderType.JIRA:
      return jiraCredentialsSchema.parse(merged);
    case ProviderType.REDMINE:
      return redmineCredentialsSchema.parse(merged);
    case ProviderType.GITLAB:
      return gitlabCredentialsSchema.parse(merged);
    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
}
