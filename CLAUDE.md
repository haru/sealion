# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sealion** is an integrated personal TODO management app that aggregates issues from multiple issue trackers (GitHub, Jira, Redmine) into a unified list. Future versions will use LLM (via LangChain) to summarize issues and auto-assign priorities.

## Tech Stack

- **Framework**: Next.js 16 + TypeScript (App Router)
- **UI**: MUI (Material UI) + Material Icons
- **Auth**: Auth.js (next-auth v5) with Prisma adapter — credentials-based (email/password)
- **Database**: PostgreSQL 16 via Prisma ORM
- **i18n**: next-intl — locales: `en` (default), `ja`; locale prefix: never (no `/en/` in URLs)
- **LLM** (future): LangChain

## Commands

```bash
npm run dev      # Start development server on http://localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint — run after every code change
npm test         # Run Jest (unit + integration tests)
npm test -- --coverage          # Run with coverage report
npm test -- --testPathPattern=<path>  # Run a single test file
npx playwright test             # Run E2E tests (requires dev server running)
npx prisma migrate dev          # Apply schema migrations
npx prisma db seed              # Seed the database
```

Coverage threshold is **95% lines** (enforced by Jest). Pages, layouts, React components, and i18n files are excluded from coverage — they are covered by E2E tests instead.

## Architecture

### Domain Model (Prisma schema)

```
User  (role: USER | ADMIN; isActive)
├── BoardSettings   (showCreatedAt, showUpdatedAt, sortOrder)
└── IssueProvider   (type: GITHUB | JIRA | REDMINE; encryptedCredentials)
    └── Project     (externalId maps to repo/project in the provider; includeUnassigned, syncError)
        └── Issue   (title, dueDate?, externalUrl; todayFlag, todayOrder?, todayAddedAt?,
                     providerCreatedAt?, providerUpdatedAt?, pinned)
```

`IssueProvider.encryptedCredentials` stores provider API tokens/keys encrypted with AES-256-GCM (`src/lib/encryption.ts`). The key is read from `CREDENTIALS_ENCRYPTION_KEY` (64-char hex = 32 bytes).

**Key notes:**
- Issue has no `status` or `priority` columns — closing an issue deletes it from the local DB.
- `BoardSettings` controls per-user board display preferences (one-to-one with User).
- `Issue.todayFlag` / `todayOrder` / `todayAddedAt` power the "Today Tasks" feature with drag-and-drop reorder (dnd-kit).
- `Issue.pinned` marks tasks as pinned for quick access.

### App Router layout

```
src/app/
  (auth)/           # Login and signup pages (public)
  (dashboard)/      # Authenticated shell: issue list + settings/providers
  admin/            # Admin-only: user management
  api/
    auth/           # Auth.js handlers + /signup
    issues/         # GET /api/issues, PATCH/DELETE /api/issues/[id]
    providers/      # CRUD for IssueProviders + GET projects per provider
    sync/           # POST /api/sync — trigger issue sync
    admin/users/    # Admin user management API
```

### Issue Provider Adapters (`src/services/issue-provider/`)

`IssueProviderAdapter` interface (in `src/lib/types.ts`) is implemented by `GitHubAdapter`, `JiraAdapter`, `RedmineAdapter`, and `GitLabAdapter`. `factory.ts` creates the right adapter from a type string + decrypted credentials. The sync flow calls the adapter to fetch remote issues and upserts them into the database.

Each adapter exports a `ProviderMetadata` constant (e.g. `githubMetadata`) and registers it in `registry.ts` at module load time. `registry.ts` exposes `getAllProviders()` and `getProviderMetadata(type)` as the sole source of provider-type knowledge for the rest of the codebase.

#### Provider type encapsulation — MANDATORY

**All provider-type-specific logic must live inside `src/services/issue-provider/`.** Code outside that directory must never branch on a specific provider type string.

| Allowed | Forbidden outside `src/services/issue-provider/` |
|---------|--------------------------------------------------|
| `getProviderMetadata(type)` | `if (type === "JIRA")` |
| `metadata.baseUrlMode === "required"` | `type === ProviderType.GITHUB` |
| `metadata.credentialFields` | `"GITHUB" \| "JIRA" \| "REDMINE" \| "GITLAB"` union literals |
| `getAllProviders()` | hardcoded provider type arrays |
| `metadata.displayName` | `t("providers.type.GITHUB")` i18n keys keyed by type |

**Adding a new provider** requires changes only inside `src/services/issue-provider/`:
1. Create the adapter class (implements `IssueProviderAdapter`).
2. Export a `ProviderMetadata` constant and call `registerProvider()`.
3. Register it in `registry.ts` (or within the adapter file itself).

No changes to API routes, UI components, credentials, or i18n files should be needed.

### Key library files (`src/lib/`)

| File | Purpose |
|------|---------|
| `auth.ts` / `auth.config.ts` | Auth.js configuration (session, callbacks) |
| `db.ts` | Singleton Prisma client |
| `encryption.ts` | AES-256-GCM encrypt/decrypt for credentials |
| `api-response.ts` | `ok(data)` / `fail(msg, status)` helpers for consistent API envelope `{ data, error }` |
| `sync-utils.ts` | Pure utility: `allProjectsProcessed()` |
| `types.ts` | Shared TypeScript types including `IssueProviderAdapter` interface |

### Middleware (`middleware.ts`)

Runs on every non-static request. Enforces:
1. Admin-only access to `/api/admin/**` (checks `role === "ADMIN"` on session)
2. next-intl locale detection on all non-API routes

### i18n

All UI strings live in `src/messages/en.json` and `src/messages/ja.json`. Use `next-intl`'s `useTranslations` / `getTranslations` — never hardcode display strings.

### User-facing messages (notifications)

Use the shared `MessageQueueProvider` / `useMessageQueue` hook for all transient notifications. **Never add standalone `Snackbar` or floating `Alert` components.**

```tsx
const { addMessage } = useMessageQueue();

addMessage("information", t("someSuccess")); // success / info
addMessage("warning",     t("someWarning")); // non-critical warning
addMessage("error",       t("someError"));   // operation failed
```

`MessageQueueProvider` is mounted in `DashboardShell` and covers all `(dashboard)` routes.

**When to use `useMessageQueue` vs. inline `Alert`:**

| Situation | Pattern |
|-----------|---------|
| Transient result of a user action (save, delete, sync, …) | `useMessageQueue` |
| Form validation / submission error (shown inside the form) | Inline `<Alert>` within the form |
| Auth page errors (login, signup — no Provider available) | Inline `<Alert>` within the page |

## Development Rules

### Language
All source code, comments, commit messages, and documentation must be in **English**.

### TDD — MANDATORY, NO EXCEPTIONS

> **This rule has been violated repeatedly. It is non-negotiable.**

**STOP. Before touching any implementation file, ask: "Does a failing test exist for this change?"**

Strict order:
1. Write the test → confirm **RED**
2. Write minimal implementation → confirm **GREEN**
3. Refactor if needed, keeping tests green

- Tests go in `tests/unit/` or `tests/integration/` (Jest) or `tests/e2e/` (Playwright)
- Pages, layouts, and components are tested via E2E, not Jest
- Run `npm test` after every change; all tests must pass before moving on

### Security
- Authorization enforced on **both** UI and API — never rely on client-side checks alone
- Users must never read or modify another user's data (enforce at API layer with session userId)
- External credentials stored encrypted (`encrypt()`/`decrypt()`) — never store plaintext tokens
- Admin routes protected in middleware and re-verified inside route handlers

### Git — NEVER commit, push, or create PRs without explicit instruction

**Never run `git commit`, `git push`, or `gh pr create` (or any variant) unless the user explicitly asks.**
This rule has no exceptions — do not commit "just to save progress" or as part of a workflow.

GitHub may be read (e.g. `gh pr view`, `gh issue list`) but **never updated** — no creating, editing, or closing PRs/issues/comments without explicit instruction.

### TSDoc — MANDATORY on all exported symbols

Every exported function, class, interface, type alias, and constant MUST have a TSDoc block
comment (`/** … */`) directly above its declaration. At minimum include:

- A one-line summary.
- `@param` for each parameter.
- `@returns` for non-void functions.
- `@throws` when the function can throw a known error type.

Internal (non-exported) helpers should have a brief comment when intent is not obvious from the
name alone. TSDoc must be in English and kept in sync with the implementation.

### ESLint
Run `npm run lint` after every code change. Config extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.

### Build
Run `npm run build` after implementation is complete to verify TypeScript compilation passes.
When the Prisma schema has changed, run `npx prisma generate` before `npm run build`.

### Database Migration — NEVER run `prisma migrate dev` without checking for drift first

**`prisma migrate dev` will reset (wipe) the database if it detects schema drift** — i.e., when the actual DB schema does not match what the migration history expects. This permanently deletes all data.

Before running `prisma migrate dev`:
1. Run `npx prisma migrate status` to check for drift or unapplied migrations.
2. If drift is detected, **stop and inform the user** — do not proceed without explicit confirmation.
3. Only run `prisma migrate dev` after confirming with the user that a DB reset is acceptable.

Schema drift typically occurs when `prisma db push` was used in a previous session instead of `prisma migrate dev`.

## Environment Variables

Required at runtime:
```
DATABASE_URL                  # PostgreSQL connection string
AUTH_SECRET                   # Auth.js v5 secret
CREDENTIALS_ENCRYPTION_KEY    # 64-char hex string (32 bytes) for AES-256-GCM
```

## Development Environment

Uses **VSCode Dev Containers**. Open in the container before starting development.

### Playwright MCP Server — accessing the local app

This environment runs in a devcontainer with a separate `browserless` container for Playwright MCP. When using Playwright MCP tools to test or interact with the local dev server, **do not use `http://localhost:3000`**. The browserless container cannot resolve `localhost` as the app container.

Use `http://app:3000` instead — `app` is the hostname of the Next.js dev container as defined in `.devcontainer/docker-compose.yml`.



## Active Technologies
- TypeScript 5 / Node.js 20 LTS, Next.js 16 (App Router), React, MUI v7, Prisma 7 with PostgreSQL 16, next-intl 4, Jest, Playwright, dnd-kit; recent additions include the `BoardSettings` table (013-board-settings).
- TypeScript 5 / Node.js 20 LTS + axios (existing), hpagent (new — provides `HttpProxyAgent` / `HttpsProxyAgent` for Node.js http/https stacks) (016-proxy-support)
- N/A — no database schema changes (016-proxy-support)
- TypeScript 5 / Node.js 20 LTS + Next.js 16 (App Router), MUI v7, Prisma 7, next-intl 4, dnd-kit (既存) (018-task-pin)
- PostgreSQL 16 via Prisma 7 — `Issue` テーブルに `pinned Boolean` カラム追加 (018-task-pin)
- TypeScript 5 / Node.js 20 LTS + Next.js 16 (App Router), MUI v7, Prisma 7, next-intl 4, React (019-task-search)
- PostgreSQL 16 via Prisma 7 — Issue.dueDate / isUnassigned / providerCreatedAt / providerUpdatedAt / project.issueProvider.type / project.displayName はすべて既存フィールド。スキーマ変更不要。 (019-task-search)
- TypeScript 5 / Node.js 20 LTS + Next.js 16 (App Router), MUI v7, Auth.js v5, next-intl 4, bcryptjs, Prisma 7 (021-account-menu-titlebar)
- PostgreSQL 16 via Prisma (no schema changes — existing `User.passwordHash` updated) (021-account-menu-titlebar)
- TypeScript 5 / Node.js 20 LTS + Next.js 16 (App Router), Auth.js v5, MUI v7, next-intl 4, Prisma 7, bcryptjs (022-admin-first-setup)
- PostgreSQL 16 via Prisma 7 — no schema changes required (022-admin-first-setup)
- TypeScript 5 / Node.js 20 LTS + Next.js 16 (App Router), MUI v7, Auth.js v5, next-intl 4, Prisma 7, bcryptjs (023-admin-user-management)
- PostgreSQL 16 via Prisma 7 — schema changes: **none** (023-admin-user-management)
- TypeScript 5 / Node.js 20 LTS + Next.js 16 (App Router), MUI v7, Auth.js v5, Prisma 7, next-intl 4 (024-auth-settings)
- PostgreSQL 16 via Prisma 7 — added `AuthSettings` table (024-auth-settings)
- TypeScript 5 / Node.js 20 LTS + Next.js 16 (App Router), axios, Prisma 7, Zod, next-intl 4 (025-add-gitlab-provider)
- PostgreSQL 16 via Prisma 7 — `ProviderType` enum updated to add `GITLAB` value only (025-add-gitlab-provider)
- TypeScript 5 / Node.js 20 LTS + Next.js 16 (App Router), MUI v7, Prisma 7, next-intl 4, nodemailer (new), existing `src/lib/encryption.ts` (026-smtp-settings)
- PostgreSQL 16 via Prisma 7 — new `SmtpSettings` singleton table (026-smtp-settings)
- PostgreSQL 16 via Prisma 7 — no schema changes (028-delete-own-account)
- TypeScript 5 / Node.js 20 LTS + Next.js 16 (App Router), Prisma 7, Zod, MUI v7, next-intl 4 (030-provider-type-abstraction)
- PostgreSQL 16 via Prisma — **no schema changes** (030-provider-type-abstraction)

## Recent Changes
- 009-task-display-cleanup: Removed `priority` field from Issue model; added `providerCreatedAt` / `providerUpdatedAt` fields; added Today tasks area with drag-and-drop reorder (dnd-kit)
- 010-sync-throttle: Introduced sync throttling logic and related tests; no database schema changes required.
- 011-close-issue-modal: Added `addComment()` to adapter interface; new Complete Issue modal; no schema changes required.
- 012-remove-issue-status: Removed `status` column from Issue table (`ALTER TABLE Issue DROP COLUMN status; DROP TYPE IssueStatus`); removed `reopenIssue` from adapter interface; closing an issue now always deletes it from the local DB.
- 015-provider-ui-modal: Replaced inline ProviderForm with AddProviderDialog modal; no schema or API changes.
