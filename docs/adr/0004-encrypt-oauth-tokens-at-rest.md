# ADR-0004: Encrypt OAuth Tokens at Rest

## Context

Auth.js v5 persists OAuth2/OIDC tokens (`access_token`, `refresh_token`, `id_token`) in the `Account` table as plaintext. This violates Constitution Principle II ("plaintext tokens MUST never be persisted") and exposes sensitive credentials if the database is compromised.

## Decision

Encrypt `Account.refresh_token` and `Account.access_token` using AES-256-GCM (via the existing `src/lib/encryption/encryption.ts` `encrypt`/`decrypt` utilities) before persistence. Encryption is applied in the Auth.js `events.linkAccount` and `events.signIn` hooks. Decryption happens lazily when the tokens are needed by downstream code.

Pre-existing plaintext values are best-effort detected (base64-GCM format check) and re-encrypted on read.

## Consequences

- Small per-request decrypt cost for tokens accessed during API calls
- Key rotation requires re-encrypting all existing tokens (handled transparently by the `events.signIn` hook on next sign-in)
- The encryption key (`CREDENTIALS_ENCRYPTION_KEY`) must be maintained across deployments — same requirement as for IssueProvider credentials

## Status: Accepted

## Date: 2026-05-17
