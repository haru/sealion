import { z } from "zod";

import type { ProviderMetadata } from "./metadata";

/** Zod schema for Jira credentials (baseUrl is merged in before validation). */
export const jiraCredentialSchema = z.object({
  baseUrl: z.string().min(1),
  email: z.string().min(1),
  apiToken: z.string().min(1),
});

/**
 * Metadata for the Jira provider.
 * This file is client-safe — it has no server-only imports.
 * @see ProviderMetadata
 */
export const jiraMetadata: ProviderMetadata = {
  type: "JIRA",
  displayName: "Jira",
  iconUrl: "/jira.svg",
  baseUrlMode: "required",
  credentialFields: [
    { key: "email", labelKey: "email", inputType: "text", required: true },
    { key: "apiToken", labelKey: "apiToken", inputType: "password", required: true },
  ],
  credentialSchema: jiraCredentialSchema,
};
