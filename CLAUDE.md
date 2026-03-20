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
User
└── IssueProvider  (type: GITHUB | JIRA | REDMINE)
    └── Project    (externalId maps to repo/project in the provider)
        └── Issue  (normalized TODO unit; status: OPEN | CLOSED; priority: LOW | MEDIUM | HIGH | CRITICAL)
```

`IssueProvider.encryptedCredentials` stores provider API tokens/keys encrypted with AES-256-GCM (`src/lib/encryption.ts`). The key is read from `CREDENTIALS_ENCRYPTION_KEY` (64-char hex = 32 bytes).

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

`IssueProviderAdapter` interface (in `src/lib/types.ts`) is implemented by `GitHubAdapter`, `JiraAdapter`, and `RedmineAdapter`. `factory.ts` creates the right adapter from a `ProviderType` + decrypted credentials. The sync flow calls the adapter to fetch remote issues and upserts them into the database.

### Key library files (`src/lib/`)

| File | Purpose |
|------|---------|
| `auth.ts` / `auth.config.ts` | Auth.js configuration (session, callbacks) |
| `db.ts` | Singleton Prisma client |
| `encryption.ts` | AES-256-GCM encrypt/decrypt for credentials |
| `api-response.ts` | `ok(data)` / `fail(msg, status)` helpers for consistent API envelope `{ data, error }` |
| `sync-utils.ts` | Pure utility: `allProjectsSynced()` |
| `types.ts` | Shared TypeScript types including `IssueProviderAdapter` interface |

### Middleware (`middleware.ts`)

Runs on every non-static request. Enforces:
1. Admin-only access to `/api/admin/**` (checks `role === "ADMIN"` on session)
2. next-intl locale detection on all non-API routes

### i18n

All UI strings live in `src/messages/en.json` and `src/messages/ja.json`. Use `next-intl`'s `useTranslations` / `getTranslations` — never hardcode display strings.

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

### Git — NEVER commit or push without explicit instruction

**Never run `git commit` or `git push` (or any variant) unless the user explicitly asks.**
This rule has no exceptions — do not commit "just to save progress" or as part of a workflow.

### ESLint
Run `npm run lint` after every code change. Config extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.

## Environment Variables

Required at runtime:
```
DATABASE_URL                  # PostgreSQL connection string
NEXTAUTH_SECRET               # Auth.js secret
CREDENTIALS_ENCRYPTION_KEY    # 64-char hex string (32 bytes) for AES-256-GCM
```

## Development Environment

Uses **VSCode Dev Containers**. Open in the container before starting development.

## Active Technologies
- TypeScript 5 / Node.js 20 (LTS) + Next.js 16.1.6, Prisma 7.5, PostgreSQL 16, next-intl 4, Auth.js v5 (003-docker-container-build)
- PostgreSQL 16 (via Prisma ORM) (003-docker-container-build)

## Recent Changes
- 003-docker-container-build: Added TypeScript 5 / Node.js 20 (LTS) + Next.js 16.1.6, Prisma 7.5, PostgreSQL 16, next-intl 4, Auth.js v5
