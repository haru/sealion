import { z } from "zod";

import type { ProviderMetadata } from "./metadata";

/** Zod schema for GitHub credentials. */
export const githubCredentialSchema = z.object({
  token: z.string().min(1),
});

/**
 * Metadata for the GitHub provider.
 * This file is client-safe — it has no server-only imports.
 * @see ProviderMetadata
 */
export const githubMetadata: ProviderMetadata = {
  type: "GITHUB",
  displayName: "GitHub",
  iconUrl: "/github.svg",
  baseUrlMode: "none",
  credentialFields: [
    { key: "token", labelKey: "token", inputType: "password", required: true },
  ],
  credentialSchema: githubCredentialSchema,
};
