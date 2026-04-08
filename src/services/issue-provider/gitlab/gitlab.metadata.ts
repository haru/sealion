import { z } from "zod";

import type { ProviderMetadata } from "@/services/issue-provider/metadata";

/** Zod schema for GitLab credentials. */
export const gitlabCredentialSchema = z.object({
  token: z.string().min(1),
});

/**
 * Metadata for the GitLab provider.
 * This file is client-safe — it has no server-only imports.
 * @see ProviderMetadata
 */
export const gitlabMetadata: ProviderMetadata = {
  type: "GITLAB",
  displayName: "GitLab",
  iconUrl: "/providers/gitlab.svg",
  baseUrlMode: "optional",
  credentialFields: [
    { key: "token", labelKey: "token", inputType: "password", required: true },
  ],
  credentialSchema: gitlabCredentialSchema,
};
