import { z } from "zod";

import type { ProviderMetadata } from "@/services/issue-provider/metadata";

/** Zod schema for Linear credentials. */
export const linearCredentialSchema = z.object({
  apiKey: z.string().min(1),
});

/**
 * Metadata for the Linear provider.
 * This file is client-safe — it has no server-only imports.
 * @see ProviderMetadata
 */
export const linearMetadata: ProviderMetadata = {
  type: "LINEAR",
  displayName: "Linear",
  iconUrl: "/providers/linear.svg",
  baseUrlMode: "none",
  credentialFields: [
    { key: "apiKey", labelKey: "apiKey", inputType: "password", required: true },
  ],
  credentialSchema: linearCredentialSchema,
};
