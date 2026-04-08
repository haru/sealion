import { ProviderType } from "@prisma/client";

import type { IssueProviderAdapter } from "@/lib/types";

import { GitHubAdapter } from "./github/github";
import { GitLabAdapter } from "./gitlab/gitlab";
import { JiraAdapter } from "./jira/jira";
import { LinearAdapter } from "./linear/linear";
import { RedmineAdapter } from "./redmine/redmine";
import { getProviderMetadata } from "./registry";

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

/** Credentials for a Linear provider. */
export interface LinearCredentials {
  apiKey: string;
}

export type ProviderCredentials =
  | GitHubCredentials
  | JiraCredentials
  | RedmineCredentials
  | GitLabCredentials
  | LinearCredentials;

/**
 * Returns the icon URL for the given provider type, or null if unknown.
 * @param type - The provider type string.
 * @returns The icon URL, or `null` if the type is not registered.
 */
export function getProviderIconUrl(type: string): string | null {
  return getProviderMetadata(type)?.iconUrl ?? null;
}

/**
 * Creates an {@link IssueProviderAdapter} for the given provider type and credentials.
 * @param type - The provider type string (e.g. `"GITHUB"`).
 * @param credentials - Decrypted credentials for the provider.
 * @param baseUrl - Optional base URL for providers that use a separate base URL
 *   (e.g. GitLab self-hosted instances). Ignored by GitHub/Jira/Redmine whose
 *   `baseUrl` is already embedded in their credential types.
 * @throws If the provider type is not supported.
 */
export function createAdapter(
  type: string,
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
    case ProviderType.LINEAR: {
      const creds = credentials as LinearCredentials;
      return new LinearAdapter(creds.apiKey);
    }
    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
}
