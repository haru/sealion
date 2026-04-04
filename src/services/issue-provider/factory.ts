import { ProviderType } from "@prisma/client";

import type { IssueProviderAdapter } from "@/lib/types";

import { GitHubAdapter } from "./github";
import { GitLabAdapter } from "./gitlab";
import { JiraAdapter } from "./jira";
import { RedmineAdapter } from "./redmine";

export interface GitHubCredentials {
  token: string;
}

export interface JiraCredentials {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface RedmineCredentials {
  baseUrl: string;
  apiKey: string;
}

/** Credentials for a GitLab provider. */
export interface GitLabCredentials {
  token: string;
}

export type ProviderCredentials =
  | GitHubCredentials
  | JiraCredentials
  | RedmineCredentials
  | GitLabCredentials;

/**
 * Returns the icon URL for the given provider type, or null if unknown.
 * @param type - The issue provider type.
 */
export function getProviderIconUrl(type: ProviderType): string | null {
  switch (type) {
    case ProviderType.GITHUB: return GitHubAdapter.iconUrl;
    case ProviderType.JIRA: return JiraAdapter.iconUrl;
    case ProviderType.REDMINE: return RedmineAdapter.iconUrl;
    case ProviderType.GITLAB: return GitLabAdapter.iconUrl;
    default: return null;
  }
}

/**
 * Creates an {@link IssueProviderAdapter} for the given provider type and credentials.
 * @param type - The issue provider type.
 * @param credentials - Decrypted credentials for the provider.
 * @param baseUrl - Optional base URL for providers that use a separate base URL
 *   (e.g. GitLab self-hosted instances). Ignored by GitHub/Jira/Redmine whose
 *   `baseUrl` is already embedded in their credential types.
 * @throws If the provider type is not supported.
 */
export function createAdapter(
  type: ProviderType,
  credentials: ProviderCredentials,
  baseUrl?: string | null,
): IssueProviderAdapter {
  switch (type) {
    case ProviderType.GITHUB: {
      const creds = credentials as GitHubCredentials;
      return new GitHubAdapter(creds.token);
    }
    case ProviderType.JIRA: {
      const creds = credentials as JiraCredentials;
      return new JiraAdapter(creds.baseUrl, creds.email, creds.apiToken);
    }
    case ProviderType.REDMINE: {
      const creds = credentials as RedmineCredentials;
      return new RedmineAdapter(creds.baseUrl, creds.apiKey);
    }
    case ProviderType.GITLAB: {
      const creds = credentials as GitLabCredentials;
      const normalized = baseUrl?.trim();
      return new GitLabAdapter(creds.token, normalized || undefined);
    }
    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
}
