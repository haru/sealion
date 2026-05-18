# ADR-0004: OAuth Token Persistence Policy

## Context

Auth.js v5 persists OAuth2/OIDC tokens (`access_token`, `refresh_token`, `id_token`) in the `Account` table as plaintext when using the PrismaAdapter default flow. This raises a concern about token exposure if the database is compromised.

## Decision

OAuth tokens are **intentionally not persisted** in the database. The custom `handleExternalSignIn` flow in `src/services/auth-provider/account-linking.ts` creates `Account` rows with only the minimum fields required for identity linkage (`provider`, `providerAccountId`, `type`, `userId`). No `access_token`, `refresh_token`, or `id_token` values are stored.

This is a stronger posture than encrypting stored tokens: tokens that are never written to disk cannot be exfiltrated from the database.

## Consequences

- Downstream code that needs a fresh access token must re-authenticate or use a separate token-refresh flow rather than reading a cached token from the `Account` table.
- Key rotation concerns that would arise from stored encrypted tokens do not apply.
- If future functionality requires persistent token storage (e.g., background sync on behalf of the user), a separate encrypted-storage mechanism following the AES-256-GCM pattern in `src/lib/encryption/encryption.ts` should be introduced at that time.

## Status: Accepted

## Date: 2026-05-18
