/**
 * Static metadata for every supported {@link AuthProviderType}.
 * This file is the **only** location outside `src/services/auth-provider/` permitted
 * to branch on provider type (per Constitution Principle III rationale).
 */

import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

import { registerAuthProvider } from "./registry";
import {
  AuthProviderType,
  type AuthProviderMetadata,
  type AuthProviderRecord,
} from "./types";

/** Auth.js OAuth2-only "checks" — `nonce` is not applicable to OAuth2. */
const OAUTH2_CHECKS = ["pkce", "state"] as const;
/** Auth.js OIDC "checks" — pkce + state + nonce per OIDC core. */
const OIDC_CHECKS = ["pkce", "state", "nonce"] as const;

const googleMetadata: AuthProviderMetadata = {
  type: AuthProviderType.GOOGLE,
  displayName: "Google",
  icon: "google",
  requiresIssuerUrl: false,
  defaultScope: "openid email profile",
  authJsProviderBuilder: (record: AuthProviderRecord) =>
    Google({
      id: record.providerId,
      name: record.displayName,
      clientId: record.clientId,
      clientSecret: record.clientSecret,
      authorization: {
        params: { scope: record.scope ?? "openid email profile" },
      },
      checks: [...OIDC_CHECKS],
    }),
};

const githubMetadata: AuthProviderMetadata = {
  type: AuthProviderType.GITHUB,
  displayName: "GitHub",
  icon: "github",
  requiresIssuerUrl: false,
  defaultScope: "read:user user:email",
  authJsProviderBuilder: (record: AuthProviderRecord) =>
    GitHub({
      id: record.providerId,
      name: record.displayName,
      clientId: record.clientId,
      clientSecret: record.clientSecret,
      authorization: {
        params: { scope: record.scope ?? "read:user user:email" },
      },
      checks: [...OAUTH2_CHECKS],
    }),
};

const microsoftEntraMetadata: AuthProviderMetadata = {
  type: AuthProviderType.MICROSOFT_ENTRA,
  displayName: "Microsoft",
  icon: "microsoft",
  requiresIssuerUrl: true,
  defaultScope: "openid email profile",
  authJsProviderBuilder: (record: AuthProviderRecord) =>
    MicrosoftEntraID({
      id: record.providerId,
      name: record.displayName,
      clientId: record.clientId,
      clientSecret: record.clientSecret,
      issuer: record.issuerUrl ?? undefined,
      authorization: {
        params: { scope: record.scope ?? "openid email profile" },
      },
      checks: [...OIDC_CHECKS],
    }),
};

const oidcGenericMetadata: AuthProviderMetadata = {
  type: AuthProviderType.OIDC_GENERIC,
  displayName: "OIDC",
  icon: "key",
  requiresIssuerUrl: true,
  defaultScope: "openid email profile",
  authJsProviderBuilder: (record: AuthProviderRecord) => ({
    id: record.providerId,
    name: record.displayName,
    type: "oidc",
    issuer: record.issuerUrl ?? "",
    clientId: record.clientId,
    clientSecret: record.clientSecret,
    authorization: {
      params: { scope: record.scope ?? "openid email profile" },
    },
    checks: [...OIDC_CHECKS],
  }),
};

registerAuthProvider(googleMetadata);
registerAuthProvider(githubMetadata);
registerAuthProvider(microsoftEntraMetadata);
registerAuthProvider(oidcGenericMetadata);
