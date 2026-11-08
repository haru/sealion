---
type: Architecture reference
title: Sealion architecture overview
description: "Runtime boundaries, request authorization, dynamic Auth.js configuration, encrypted settings, and persistence architecture for Sealion."
tags: [architecture, nextjs, auth, prisma, security]
---

# Architecture overview

Sealion is one Next.js App Router application. Pages and route handlers live under [`src/app/`](../../src/app/); shared server/client utilities are under [`src/lib/`](../../src/lib/); reusable UI and hooks are under [`src/components/`](../../src/components/) and [`src/hooks/`](../../src/hooks/); external tracker orchestration is under [`src/services/`](../../src/services/).

## Request boundaries

```mermaid
sequenceDiagram
    participant Browser
    participant Route as Next.js route
    participant Auth as Auth.js
    participant DB as Prisma PostgreSQL
    participant Remote as External service
    Browser->>Route: page or API request
    Route->>Auth: authenticate session
    Auth-->>Route: user identity and role
    Route->>DB: user-scoped read or write
    Route->>Remote: adapter operation when needed
    Remote-->>Route: provider response
    Route-->>Browser: shared API envelope or page
```

Caption: A typical authenticated request crosses route, session, database, and optional remote-provider boundaries.

The root layout composes MUI, `next-intl`, global styling, and the application shell. Middleware in [`middleware.ts`](../../middleware.ts) checks `ADMIN` for `/admin/**` and `/api/admin/**`, but deliberately passes other API paths through. Therefore ordinary API handlers must call `auth()` and apply ownership predicates themselves.

## Authentication architecture

[`src/lib/auth/auth.ts`](../../src/lib/auth/auth.ts) builds the full Auth.js runtime configuration. Local credentials use bcrypt and reject pending, suspended, or passwordless users as appropriate. Enabled external providers are loaded from database configuration through [`src/services/auth-provider/`](../../src/services/auth-provider/).

The dynamic provider decision is recorded in [ADR 0002](../../docs/adr/0002-dynamic-auth-provider-loading.md): provider records are cached for 30 seconds and admin writes invalidate the cache. [ADR 0003](../../docs/adr/0003-reuse-authjs-account-table.md) explains why external links use Auth.js `Account` rows and why automatic dangerous email linking is not enabled. Session JWT claims carry user identity, role, and Gravatar preference; the JWT callback now revalidates the authoritative user record on every `auth()` or session fetch rather than trusting stale role or time claims.

### Session validity and revocation

[`src/lib/auth/session-validity.ts`](../../src/lib/auth/session-validity.ts) evaluates app-owned `authTime` and `lastActivityAt` claims against the current user. A session is rejected when the user is missing or inactive, its sign-in predates `passwordChangedAt` or `sessionsRevokedAt`, or its last activity exceeds the configured idle timeout. `iat` and `exp` are not used for security decisions because Auth.js rewrites them during encoding. Only an explicit `update({ activity: true })` from the dashboard activity tracker refreshes the idle timestamp; ordinary refetches do not.

Admin demotion or deactivation sets `User.sessionsRevokedAt`, making revocation irreversible for the affected token even if the user is later promoted or reactivated. Database errors during validation fail closed: the error is logged with the validation step and Auth.js invalidates the session rather than accepting an unverifiable token. See [ADR 0006](../../docs/adr/0006-session-validity-per-request.md) for the security rationale and migration behavior.

## Persistence and security boundaries

[`src/lib/db/db.ts`](../../src/lib/db/db.ts) exposes a reused Prisma client backed by PostgreSQL. [`prisma/schema.prisma`](../../prisma/schema.prisma) is canonical for identity, board, issue, auth-provider, and SMTP settings. Sensitive provider credentials, IdP client secrets, and SMTP passwords are encrypted by [`src/lib/encryption/`](../../src/lib/encryption/); API responses must never expose them.

The [data model](../domain/data-model.md) defines the ownership chain and issue lifecycle. The [synchronization workflow](../workflows/synchronization.md) explains why remote calls and local writes are intentionally separated by the adapter/service layers.

## Change constraints

- Use the `@/*` alias for `src/*`; parent-relative imports are prohibited by project conventions.
- Validate inputs at API boundaries with the existing validation seams and return the shared `{ data, error, errorDetails? }` envelope.
- Keep provider-specific behavior in `src/services/issue-provider/` and IdP-specific behavior in `src/services/auth-provider/`.
- Localize user-visible strings in English and Japanese.
- Re-verify authorization in route handlers even when a page or middleware already checks it.
- Add an append-only ADR under [`docs/adr/`](../../docs/adr/) for consequential architectural decisions.
