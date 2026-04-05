import { z } from "zod";

import type { ProviderMetadata } from "./metadata";

/** Zod schema for Redmine credentials (baseUrl is merged in before validation). */
export const redmineCredentialSchema = z.object({
  baseUrl: z.string().min(1),
  apiKey: z.string().min(1),
});

/**
 * Metadata for the Redmine provider.
 * This file is client-safe — it has no server-only imports.
 * @see ProviderMetadata
 */
export const redmineMetadata: ProviderMetadata = {
  type: "REDMINE",
  displayName: "Redmine",
  iconUrl: "/redmine.svg",
  baseUrlMode: "required",
  credentialFields: [
    { key: "apiKey", labelKey: "apiKey", inputType: "password", required: true },
  ],
  credentialSchema: redmineCredentialSchema,
};
