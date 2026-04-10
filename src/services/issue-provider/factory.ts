import type { IssueProviderAdapter } from "@/lib/types";

import { AsanaAdapter } from "./asana/asana";
import { BacklogAdapter } from "./backlog/backlog";
import { GitHubAdapter } from "./github/github";
import { GitLabAdapter } from "./gitlab/gitlab";
import { JiraAdapter } from "./jira/jira";
import { LinearAdapter } from "./linear/linear";
import { RedmineAdapter } from "./redmine/redmine";
import { getProviderMetadata } from "./registry";
import { TrelloAdapter } from "./trello/trello";

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

/** Credentials for an Asana provider. */
export interface AsanaCredentials {
  token: string;
}

/** Credentials for a Trello provider. */
export interface TrelloCredentials {
  apiKey: string;
  apiToken: string;
}

/** Credentials for a Backlog provider. */
export interface BacklogCredentials {
  baseUrl: string;
  apiKey: string;
}

export type ProviderCredentials =
  | GitHubCredentials
  | JiraCredentials
  | RedmineCredentials
  | GitLabCredentials
  | LinearCredentials
  | AsanaCredentials
  | TrelloCredentials
  | BacklogCredentials;

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
    case "GITHUB": {
      const creds = credentials as GitHubCredentials;
      return new GitHubAdapter(creds.token);
    }
    case "JIRA": {
      const creds = credentials as JiraCredentials;
      return new JiraAdapter(creds.baseUrl, creds.email, creds.apiToken);
    }
    case "REDMINE": {
      const creds = credentials as RedmineCredentials;
      return new RedmineAdapter(creds.baseUrl, creds.apiKey);
    }
    case "GITLAB": {
      const creds = credentials as GitLabCredentials;
      const normalized = baseUrl?.trim();
      return new GitLabAdapter(creds.token, normalized || undefined);
    }
    case "LINEAR": {
      const creds = credentials as LinearCredentials;
      return new LinearAdapter(creds.apiKey);
    }
    case "ASANA": {
      const creds = credentials as AsanaCredentials;
      return new AsanaAdapter(creds.token);
    }
    case "TRELLO": {
      const creds = credentials as TrelloCredentials;
      return new TrelloAdapter(creds.apiKey, creds.apiToken);
    }
    case "BACKLOG": {
      const creds = credentials as BacklogCredentials;
      return new BacklogAdapter(creds.baseUrl, creds.apiKey);
    }
    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
}
