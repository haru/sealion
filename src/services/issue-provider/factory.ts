import { ProviderType } from "@prisma/client";
import { IssueProviderAdapter } from "@/lib/types";
import { GitHubAdapter } from "./github";
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

export type ProviderCredentials =
  | GitHubCredentials
  | JiraCredentials
  | RedmineCredentials;

export function createAdapter(
  type: ProviderType,
  credentials: ProviderCredentials
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
    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
}
