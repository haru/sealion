import { z } from "zod";

import type { ProviderMetadata } from "@/services/issue-provider/metadata";

/**
 * Zod schema for Backlog credentials.
 * `baseUrl` is merged in by the UI via `baseUrlMode: "required"` before validation.
 */
export const backlogCredentialSchema = z.object({
  baseUrl: z.string().min(1),
  apiKey: z.string().min(1),
});

/**
 * Metadata for the Backlog issue provider.
 * This file is client-safe — it has no server-only imports.
 *
 * @see ProviderMetadata
 */
export const backlogMetadata: ProviderMetadata = {
  type: "BACKLOG",
  displayName: "Backlog",
  iconUrl: "/providers/backlog.svg",
  baseUrlMode: "required",
  credentialFields: [
    { key: "apiKey", labelKey: "apiKey", inputType: "password", required: true },
  ],
  credentialSchema: backlogCredentialSchema,
};
