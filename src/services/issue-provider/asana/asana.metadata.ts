import { z } from "zod";

import type { ProviderMetadata } from "@/services/issue-provider/metadata";

/** Zod schema for Asana credentials. */
export const asanaCredentialSchema = z.object({
  token: z.string().min(1),
});

/**
 * Metadata for the Asana provider.
 * This file is client-safe — it has no server-only imports.
 * @see ProviderMetadata
 */
export const asanaMetadata: ProviderMetadata = {
  type: "ASANA",
  displayName: "Asana",
  iconUrl: "/providers/asana.svg",
  baseUrlMode: "none",
  credentialFields: [
    { key: "token", labelKey: "token", inputType: "password", required: true },
  ],
  credentialSchema: asanaCredentialSchema,
};
