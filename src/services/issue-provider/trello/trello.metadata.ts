import { z } from "zod";

import type { ProviderMetadata } from "@/services/issue-provider/metadata";

/** Zod schema for Trello credentials. */
export const trelloCredentialSchema = z.object({
  apiKey: z.string().min(1),
  apiToken: z.string().min(1),
});

/**
 * Metadata for the Trello provider.
 * This file is client-safe — it has no server-only imports.
 * @see ProviderMetadata
 */
export const trelloMetadata: ProviderMetadata = {
  type: "TRELLO",
  displayName: "Trello",
  iconUrl: "/providers/trello.svg",
  baseUrlMode: "none",
  credentialFields: [
    { key: "apiKey", labelKey: "apiKey", inputType: "password", required: true },
    { key: "apiToken", labelKey: "apiToken", inputType: "password", required: true },
  ],
  credentialSchema: trelloCredentialSchema,
};
