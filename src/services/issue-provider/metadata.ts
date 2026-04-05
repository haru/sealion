import type { z } from "zod";

/**
 * Describes how a provider uses the `baseUrl` field.
 * - `"required"` — baseUrl is mandatory (e.g. Jira, Redmine).
 * - `"optional"` — baseUrl can be supplied but defaults to the SaaS URL (e.g. GitLab).
 * - `"none"` — baseUrl is not applicable (e.g. GitHub).
 */
export type BaseUrlMode = "required" | "optional" | "none";

/**
 * Defines a single credential input field for a provider.
 */
export interface CredentialFieldDefinition {
  /** Field key used in the credential record (e.g. `"token"`, `"apiToken"`). */
  key: string;
  /** i18n key within the `"providers.fields"` namespace. */
  labelKey: string;
  /** HTML input type for the field. */
  inputType: "text" | "password";
  /** Whether the field is required. */
  required: boolean;
}

/**
 * Static metadata describing a single issue provider type.
 * Used by the registry to drive UI rendering, credential validation, and API logic
 * without hardcoded `switch` statements.
 */
export interface ProviderMetadata {
  /** Matches the Prisma `ProviderType` enum value (e.g. `"GITHUB"`). */
  type: string;
  /** Human-readable provider name. Not translated — proper noun. */
  displayName: string;
  /** Path to the provider icon SVG, or `null` if unavailable. */
  iconUrl: string | null;
  /** Describes how this provider uses the `baseUrl` field. */
  baseUrlMode: BaseUrlMode;
  /** Credential input fields to render in the UI (does NOT include `baseUrl`). */
  credentialFields: CredentialFieldDefinition[];
  /** Zod schema used to validate provider credentials. */
  credentialSchema: z.ZodSchema;
}
