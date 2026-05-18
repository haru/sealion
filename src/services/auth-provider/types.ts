/**
 * Shared type definitions for the external auth-provider service.
 * Defines the metadata shape, decrypted DB record shape, and re-exports the Prisma enum.
 */

import { AuthProviderType as PrismaAuthProviderType } from "@prisma/client";
import type { Provider } from "next-auth/providers";

/**
 * Re-export of the Prisma `AuthProviderType` enum so that the rest of the codebase
 * can depend on `@/services/auth-provider` without importing `@prisma/client` directly.
 */
export const AuthProviderType = PrismaAuthProviderType;
/** Type alias for the Prisma `AuthProviderType` enum. */
export type AuthProviderType = PrismaAuthProviderType;

/**
 * A decrypted, app-facing view of an `AuthProvider` DB row. The `clientSecret`
 * field is plaintext here and MUST never leak outside the service module.
 */
export interface AuthProviderRecord {
  /** Internal DB id (cuid). */
  id: string;
  /** Auth.js provider key (e.g. `"google"`, `"keycloak-corp"`). Unique. */
  providerId: string;
  /** Provider kind. Drives metadata + Auth.js builder selection. */
  type: AuthProviderType;
  /** Display label shown on the login button (e.g. `"Google でログイン"`). */
  displayName: string;
  /** When `false`, the provider is hidden from the login UI and the Auth.js providers list. */
  enabled: boolean;
  /** OIDC issuer URL. Required for `OIDC_GENERIC` and `MICROSOFT_ENTRA`; `null` otherwise. */
  issuerUrl: string | null;
  /** Plaintext client ID from the IdP registration. */
  clientId: string;
  /** Plaintext client secret (decrypted from `encryptedClientSecret`). */
  clientSecret: string;
  /** Optional OAuth/OIDC scope override. When `null`, the metadata's `defaultScope` applies. */
  scope: string | null;
  /** Row creation timestamp. */
  createdAt: Date;
  /** Row last-update timestamp. */
  updatedAt: Date;
  /** ID of the admin that created this row, if known. */
  createdById: string | null;
  /** ID of the admin that last updated this row, if known. */
  updatedById: string | null;
}

/**
 * Static, per-provider-type metadata describing UI presentation and Auth.js wiring.
 * One entry per {@link AuthProviderType}, registered at module load by `metadata.ts`.
 */
export interface AuthProviderMetadata {
  /** Provider kind. Matches the Prisma enum. */
  type: AuthProviderType;
  /** Default English-language display label, used by the admin form if the row has none. */
  displayName: string;
  /** Icon hint consumed by the `ProviderIcon` component. */
  icon: "google" | "github" | "microsoft" | "key";
  /** When `true`, the admin form must collect `issuerUrl`. */
  requiresIssuerUrl: boolean;
  /** OAuth/OIDC scope applied when the DB row's `scope` column is `null`. */
  defaultScope: string;
  /**
   * Builds the Auth.js provider config for this type from a decrypted DB record.
   *
   * @param record - The decrypted {@link AuthProviderRecord} from the DB.
   * @returns A configured Auth.js {@link Provider} ready to be passed to `NextAuth({ providers: [...] })`.
   */
  authJsProviderBuilder: (record: AuthProviderRecord) => Provider;
}
