# Architecture

## Runtime boundaries

Sealion is a single Next.js application. App Router pages, layouts, and route handlers live under [`src/app/`](../src/app/); shared server and client utilities live under [`src/lib/`](../src/lib/); feature UI is in [`src/components/`](../src/components/), hooks in [`src/hooks/`](../src/hooks/), and integration orchestration in [`src/services/`](../src/services/).

```text
Browser
  ├─ App Router pages / MUI components / hooks
  └─ /api route handlers
       ├─ Auth.js session + authorization checks
       ├─ Prisma/PostgreSQL
       ├─ encrypted credential helpers
       └─ issue-provider/auth-provider service registries
            └─ remote tracker or identity-provider APIs
```

The root layout establishes the application-wide composition (MUI, i18n, global styling) in [`src/app/layout.tsx`](../src/app/layout.tsx). The dashboard, auth pages, admin area, and API routes are separate route surfaces. Dashboard pages require a signed-in user via their layout; middleware applies role checks for admin pages and `/api/admin/**` only ([`middleware.ts`](../middleware.ts)).

## Storage and tenant boundaries

[`prisma/schema.prisma`](../prisma/schema.prisma) is the canonical data model.

| Area | Main models | Meaning |
| --- | --- | --- |
| Identity | `User`, `Account`, `Session`, `VerificationToken` | Local accounts plus Auth.js-linked external accounts/sessions. |
| Personal board | `BoardSettings` | Per-user field visibility and sort order. |
| Issue aggregation | `IssueProvider`, `Project`, `Issue` | A user-owned connection contains selected external projects and their normalized open issues. |
| Administration | `AuthProvider`, `AuthSettings`, `SmtpSettings` | Runtime-configured IdPs, login policy, and singleton mail settings. |

Ownership is enforced by traversing `Issue → Project → IssueProvider.userId`. This is the pattern route handlers should use, rather than trusting an internal ID alone. Provider tokens are stored in `IssueProvider.encryptedCredentials`; external IdP client secrets and SMTP passwords are likewise encrypted fields.

## API and service conventions

- Route handlers use the shared `{ data, error, errorDetails? }` response helpers in [`src/lib/api/api-response.ts`](../src/lib/api/api-response.ts).
- Handlers authenticate with `auth()` and then filter by session user ID. Do not assume middleware has authenticated ordinary `/api/**` traffic.
- `src/lib/encryption/` handles AES-256-GCM and typed provider credentials; the provider creation path validates and tests credentials before encrypting them.
- Shared search, sorting, validation, mail, proxy, sync-error, and UI utilities are colocated beneath `src/lib/`.

## Authentication design

[`src/lib/auth/auth.ts`](../src/lib/auth/auth.ts) builds Auth.js configuration dynamically. It always offers local credentials and reads enabled external providers from PostgreSQL through `src/services/auth-provider/`. This lets an admin enable, disable, or change IdPs without rebuilding the application. The design is recorded in [ADR 0002](../docs/adr/0002-dynamic-auth-provider-loading.md).

Authentication also carries role and Gravatar preference in the JWT, supports optional configured session expiry, and rechecks password changes periodically to invalidate stale sessions. External account linking is explicit rather than using Auth.js's dangerous automatic email-linking option (see [ADR 0003](../docs/adr/0003-reuse-authjs-account-table.md)).

## Design constraints that shape changes

- The codebase uses `@/*` for `src/*`; parent-relative imports are prohibited by project conventions.
- APIs should validate inputs at boundaries, keep errors user-safe, and avoid logging raw remote errors that may contain authorization headers.
- All user-visible UI strings need both English and Japanese message entries.
- An ADR in [`docs/adr/`](../docs/adr/) is expected for a consequential architectural decision; ADRs are append-only.

For behavior rather than structure, continue with [workflows and domain rules](./workflows.md). For exact change entry points, see the [source map](./source-map.md).
