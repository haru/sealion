# ADR 0002: Dynamic auth-provider loading

## Context

Feature 041 (OIDC authentication) requires administrators to add and remove external IdPs (Google, GitHub, Microsoft Entra ID, generic OIDC) at runtime via a UI. Two operational constraints follow:

1. **No restart on configuration change** (FR-012): adding or disabling an IdP must take effect within seconds, not require a deploy.
2. **The IdP catalog lives in PostgreSQL** (decided in spec Clarifications, 2026-05-17): client secrets are encrypted at rest in the `AuthProvider` table.

Auth.js v5 (`next-auth ^5.0.0-beta.31`) is the existing authentication library. Its `NextAuth({...})` entry point traditionally takes a static configuration object built at module load time. With that pattern, the providers list is frozen until the Node process restarts.

We evaluated three approaches:

- **A. Env-vars-only**: configure each IdP via environment variables, read at process start. Simple, but requires a redeploy on every change and offers no admin-UI surface. Rejected during Q2 of spec Clarifications.
- **B. Build-time generation**: read the DB at build time, bake providers into the bundle. Tight build/deploy coupling, worst of both worlds for ops. Rejected.
- **C. Restart on change**: run a process supervisor that restarts the app whenever an admin saves the form. User experience is poor (an active user's session round-trip can fail mid-flight) and the deploy story still has to be uniform across environments. Rejected.
- **D. Request-aware Auth.js config**: Auth.js v5 supports passing a function — `NextAuth((request) => ({...}))` — that returns the config per request. We can read `AuthProvider` rows on each invocation and build the providers array on the fly. **Adopted.**

The remaining concern with (D) is performance: a DB round-trip on every auth route hit. We mitigate it with `unstable_cache(TTL=30s, tags=["auth-providers"])` and invalidate via `revalidateTag("auth-providers")` from the admin create/update/delete handlers. A 30-second worst-case staleness window is acceptable for the admin operation cadence.

## Decision

Refactor `src/lib/auth/auth.ts` from `NextAuth({...})` (static object) to `NextAuth(async () => ({...}))` (request-aware async function).

Within the dynamic config:

1. Call `listEnabled()` on `src/services/auth-provider/repository.ts`, which is wrapped in `unstable_cache({ tags: ["auth-providers"] })` with a 30-second TTL.
2. Map each `AuthProvider` row through the metadata registry (`src/services/auth-provider/metadata.ts`) to its Auth.js provider builder.
3. Prepend the existing `Credentials` provider so that local authentication continues to work unchanged.

The admin write handlers (`POST/PATCH/DELETE /api/admin/auth-providers[...]`) call `revalidateTag("auth-providers")` after a successful mutation to invalidate the cache immediately.

## Status

Accepted

## Consequences

**Positive**:
- Administrators add or disable an IdP and see the change in the login UI within ≤ 30 seconds without a redeploy.
- Auth.js continues to own PKCE, state, nonce, and JWKS rotation — we don't reimplement OAuth/OIDC machinery.
- The Credentials provider is unaffected; ローカル認証は引き続き動作する.
- A future `revalidateTag` from any other surface (e.g. a CLI maintenance command) immediately drops the cache.

**Negative**:
- The first request after a 30-second cache expiry incurs a DB read. Acceptable: < 5 ms on a hot connection.
- Up to 30 seconds of staleness on a config change. Mitigated by the explicit invalidation on write paths.
- The Auth.js dynamic-config pattern is documented but newer than the static form; future Auth.js upgrades must verify continued support.

**Neutral**:
- We are not adopting Auth.js's `allowDangerousEmailAccountLinking`. Account linking is implemented explicitly in `signIn` after a strict `email_verified` check (see [ADR 0003](./0003-reuse-authjs-account-table.md)).

## Date

2026-05-17
