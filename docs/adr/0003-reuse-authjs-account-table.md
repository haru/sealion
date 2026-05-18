# ADR 0003: Reuse Auth.js `Account` table for IdP links

## Context

Feature 041 (OIDC authentication) needs to record the relationship between a Sealion `User` and one or more external IdP identities (`provider`, `providerAccountId`). The Auth.js Prisma adapter ships a standard `Account` model that already encodes exactly this relationship — see [`prisma/schema.prisma:151`](../../prisma/schema.prisma) — and the unique constraint `@@unique([provider, providerAccountId])` is already in place.

We considered two options:

- **A. Introduce a new `AccountLink` model**. Initially proposed in the spec's Key Entities section. Cleaner separation between "the IdP told us about this user" and "Auth.js's bookkeeping," but it duplicates the existing schema, requires Auth.js to write to one table while Sealion code writes to another, and would force every read path that joins IdP links to a user to choose between them.
- **B. Reuse the existing Auth.js `Account` table**. Single source of truth, zero schema additions for the link itself, and Auth.js's Prisma adapter already populates it on the OIDC/OAuth2 happy path. Sealion code that needs the link reads `User.accounts`. **Adopted.**

The remaining design point is how to handle **automatic account linking by verified email** safely. Auth.js exposes a feature flag — `allowDangerousEmailAccountLinking: true` — that delegates the entire linking decision to the framework. The flag is named "dangerous" for a reason: if an IdP misreports `email_verified=true` (configuration bug, attacker-controlled IdP, etc.), a legitimate Sealion account can be hijacked.

## Decision

1. **Reuse the existing `Account` table** for all IdP linkage. Do **not** introduce a new `AccountLink` model.
2. **Do not enable `allowDangerousEmailAccountLinking`.** Instead, implement the linking decision explicitly in `src/services/auth-provider/account-linking.ts`, invoked from `src/lib/auth/auth.config.ts` `callbacks.signIn`:
   - Normalise `profile.email` to lowercase.
   - Require `profile.email_verified === true` (or, for GitHub, a verified primary email from `/user/emails`).
   - If an existing `User` with the same email is found, attach a new `Account` row to it.
   - If no user exists, honour `AuthSettings.allowUserSignup` and `AuthSettings.requireEmailVerification` before creating a new `User` with `passwordHash: null`.
3. **Preserve `Account.@@unique([provider, providerAccountId])`** so the same IdP `sub` cannot be linked twice or to different users.

## Status

Accepted

## Consequences

**Positive**:
- One table, one Prisma migration delta for the link itself (the new model is `AuthProvider`, not the link).
- The Auth.js Prisma adapter continues to manage `Account` on the happy path; our `signIn` callback only does the explicit verification + `prisma.account.create({...})` when the framework wouldn't link by default.
- Refusing `allowDangerousEmailAccountLinking` removes a known account-takeover footgun.
- The `signIn` callback gives a clear, testable place to enforce `AuthSettings.allowUserSignup` and `requireEmailVerification` for OIDC flows.

**Negative**:
- The `Account` table is now load-bearing for two responsibilities (Auth.js bookkeeping + Sealion linkage). Schema changes by Auth.js upgrades must be checked for compatibility with our read paths.
- The signIn callback must keep its verification logic in lock-step with the IdP capability matrix (Google/Entra return `email_verified`; GitHub does not, hence the `/user/emails` fallback).

**Neutral**:
- Future encryption of `Account.refresh_token` / `access_token` / `id_token` (Constitution Principle II) is a follow-up captured by [ADR 0004](./0004-encrypt-oauth-tokens-at-rest.md) (Polish phase of feature 041).
- An `AccountLink` model can be revisited later if Auth.js's `Account` schema diverges sharply from our needs — that would require a superseding ADR.

## Date

2026-05-17
