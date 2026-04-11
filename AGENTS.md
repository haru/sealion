# AGENTS.md

This file is the **single source of truth** for AI agent guidance in this repository.
Other instruction files (`.github/copilot-instructions.md`, `CLAUDE.md`) reference this file — do not duplicate content there.

## Project Overview

**Sealion** is an integrated personal TODO management app that aggregates issues from multiple issue trackers (GitHub, GitLab, Jira, Redmine, Linear, Asana, Trello, Backlog) into a unified list. Future versions will use LLM (via LangChain) to summarize issues and auto-assign priorities.

## Tech Stack

- **Framework:** Next.js 16 + TypeScript (App Router)
- **UI:** MUI (Material UI) v7 + Material Icons + dnd-kit (drag-and-drop) + @mui/x-data-grid
- **Auth:** Auth.js (next-auth v5) with Prisma adapter — credentials-based (email/password)
- **Database:** PostgreSQL 16 via Prisma 7 ORM
- **i18n:** next-intl 4 — locales: `en` (default), `ja`; locale prefix: never (no `/en/` in URLs)
- **HTTP:** axios + hpagent (proxy support)
- **LLM (future):** LangChain
- **Dev environment:** VSCode Dev Containers

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

## Project Structure

```
src/
  app/                    # Next.js App Router pages and layouts
    (auth)/               # Public: login, signup
    (dashboard)/          # Protected: issue list, settings/providers
    admin/                # Admin-only: user management
    api/                  # API routes (auth, issues, providers, sync, admin)
  components/             # React components (providers/, todo/, ui/)
  i18n/                   # next-intl config (request.ts, routing.ts)
  lib/                    # Shared utilities (auth, db, encryption, types)
  messages/               # i18n strings (en.json, ja.json)
  services/               # Business logic (sync.ts, issue-provider/)
  types/                  # Type augmentations (next-auth.d.ts)
tests/
  unit/                   # Jest unit tests
  integration/            # Jest integration tests (API endpoints)
  e2e/                    # Playwright E2E tests
prisma/                   # Schema, migrations, seed
specs/                    # Feature specs and implementation plans
docs/                     # Requirements and rules (Japanese)
```

Path alias: `@/*` maps to `./src/*` (configured in tsconfig.json).

## Architecture

### Domain Model (Prisma schema)

```
User  (role: USER | ADMIN; isActive)
├── BoardSettings   (showCreatedAt, showUpdatedAt, sortOrder)
└── IssueProvider   (type: text — e.g. GITHUB, GITLAB, JIRA, REDMINE, LINEAR, ASANA, TRELLO, BACKLOG)
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

`IssueProviderAdapter` interface (in `src/lib/types.ts`) is implemented by `GitHubAdapter`, `GitLabAdapter`, `JiraAdapter`, `RedmineAdapter`, `LinearAdapter`, `AsanaAdapter`, `TrelloAdapter`, and `BacklogAdapter`. `factory.ts` creates the right adapter from a provider type string + decrypted credentials. Methods: `testConnection()`, `listProjects()`, `fetchAssignedIssues()`, `closeIssue()`, `addComment()`.

Each adapter exports a `ProviderMetadata` constant and registers it in `registry.ts`. `registry.ts` exposes `getAllProviders()` and `getProviderMetadata(type)` as the sole source of provider-type knowledge.

#### Provider type encapsulation — MANDATORY

**All provider-type-specific logic must live inside `src/services/issue-provider/`.** Code outside that directory must never branch on a specific provider type string.

| Allowed | Forbidden outside `src/services/issue-provider/` |
|---------|--------------------------------------------------|
| `getProviderMetadata(type)` | `if (type === "JIRA")` |
| `metadata.credentialFields` | hardcoded provider type arrays |
| `metadata.displayName` | `t("providers.type.GITHUB")` i18n keys keyed by type |

**Adding a new provider** — see **[ADDING_A_PROVIDER.md](./ADDING_A_PROVIDER.md)** for the full step-by-step guide.

### Sync Service (`src/services/sync.ts`)

Concurrency-controlled syncing using `p-limit` (3 providers, 5 projects). External service is source of truth — upserts all returned issues. Handles rate limit errors; stores sync timestamps and error messages per project.

### API Response Envelope (`src/lib/api-response.ts`)

All API routes return `{ data: T | null, error: string | null }` using `ok(data)` / `fail(error, status)` helpers.

### Credential Encryption (`src/lib/encryption.ts`)

AES-256-GCM with format `iv:authTag:ciphertext` (base64). Key from `CREDENTIALS_ENCRYPTION_KEY` env var (64-char hex = 32 bytes).

### Auth (`src/lib/auth.ts` + `src/lib/auth.config.ts`)

Credentials-based with bcryptjs password hashing, JWT sessions (30-day max age), session callbacks attach `user.id` and `user.role`.

### Key library files (`src/lib/`)

| File | Purpose |
|------|---------|
| `auth.ts` / `auth.config.ts` | Auth.js configuration (session, callbacks) |
| `db.ts` | Singleton Prisma client (dev-mode query logging) |
| `encryption.ts` | AES-256-GCM encrypt/decrypt for credentials |
| `api-response.ts` | `ok(data)` / `fail(msg, status)` helpers for consistent API envelope |
| `sync-utils.ts` | Pure utility: `allProjectsProcessed()` |
| `types.ts` | Shared TypeScript types including `IssueProviderAdapter` interface |

### Middleware (`middleware.ts`)

Runs on every non-static request. Enforces:
1. Admin-only access to `/api/admin/**` (checks `role === "ADMIN"` on session)
2. next-intl locale detection on all non-API routes
3. Authentication for protected pages

### i18n

All UI strings live in `src/messages/en.json` and `src/messages/ja.json`. Use `useTranslations` (client) or `getTranslations` (server) from next-intl — never hardcode display strings.

### User-facing messages (notifications)

Use the shared `MessageQueueProvider` / `useMessageQueue` hook for all transient notifications. **Never add standalone `Snackbar` or floating `Alert` components.**

| Situation | Pattern |
|-----------|---------|
| Transient result of a user action (save, delete, sync, …) | `useMessageQueue` |
| Form validation / submission error (shown inside the form) | Inline `<Alert>` within the form |
| Auth page errors (login, signup — no Provider available) | Inline `<Alert>` within the page |

## Coding Conventions

### Language
All source code, comments, commit messages, and documentation must be written in **English**.

### TypeScript Style
- Use `interface` for extensible object shapes; `type` for unions/intersections/tuples
- Avoid `any` — use `unknown` instead
- Prefer immutable patterns: spread operators, `Readonly<T>`, `as const`
- Use Zod for input validation at system boundaries
- React components use named prop interfaces (e.g., `interface ButtonProps`)
- Do not use `console.log` in production code

### TSDoc — Mandatory on All Exported Symbols

Every exported function, class, interface, type alias, and constant **must** have a TSDoc block comment (`/** … */`). At minimum include a one-line summary, `@param` for each parameter, `@returns` for non-void functions, `@throws` when applicable.

### File Organization
- Many small files over few large files (200–400 lines typical, 800 max)
- High cohesion, low coupling
- Organize by feature/domain, not by type

### Immutability (Critical)
Always create new objects — never mutate existing ones. Use spread operators and functional patterns.

### Error Handling
- Handle errors explicitly at every level
- Provide user-friendly messages in UI-facing code
- Log detailed error context server-side
- Never silently swallow errors

## Testing

### TDD — MANDATORY, NO EXCEPTIONS

**STOP. Before touching any implementation file, ask: "Does a failing test exist for this change?"**

1. Write the test → confirm **RED**
2. Write minimal implementation → confirm **GREEN**
3. Refactor if needed, keeping tests green
4. Verify **95% line coverage** with `npm test -- --coverage`

### Test Placement

| Change location | Test location |
|----------------|---------------|
| `src/lib/` | `tests/unit/lib/` |
| `src/services/` | `tests/unit/services/` |
| `src/app/api/` | `tests/integration/api/` |
| Pages / components | `tests/e2e/flows/` |

### Integration Test Patterns
- Use real Prisma + test database (same dev container PostgreSQL)
- Mock session via `jest.mock` on `@/lib/auth`
- Mock external adapters (GitHub, Jira, Redmine APIs)
- Create test user in `beforeAll`, clean up in `afterAll`

## Security

- Authorization enforced on **both** UI and API — never rely on client-side checks alone
- Users must never read or modify another user's data (enforce at API layer with session userId)
- External credentials stored encrypted (`encrypt()`/`decrypt()`) — never store plaintext tokens
- Admin routes protected in middleware **and** re-verified inside route handlers
- Never hardcode secrets — use environment variables or a secret manager
- Parameterized queries only (Prisma handles this)
- Sanitize all user-facing output (XSS prevention)

## Development Rules

### Git — NEVER commit, push, or create PRs without explicit instruction

**Never run `git commit`, `git push`, or `gh pr create` (or any variant) unless the user explicitly asks.**
This rule has no exceptions. GitHub may be read but **never updated** without explicit instruction.

### Git Workflow
- Commit message format: `<type>: <description>` (feat, fix, refactor, docs, test, chore, perf, ci)
- Git Flow branching model (git-flow is installed in the dev container)

### ESLint
Run `npm run lint` after every code change.

### Build
Run `npm run build` after implementation is complete to verify TypeScript compilation passes.
When the Prisma schema has changed, run `npx prisma generate` before `npm run build`.

### Database Migration — NEVER run `prisma migrate dev` without checking for drift first

**`prisma migrate dev` will reset (wipe) the database if it detects schema drift.** Before running:
1. Run `npx prisma migrate status` to check for drift or unapplied migrations.
2. If drift is detected, **stop and inform the user** — do not proceed without explicit confirmation.

## Design Patterns

- **Adapter / Factory Pattern** for issue providers — see [ADDING_A_PROVIDER.md](./ADDING_A_PROVIDER.md)
- **Consistent API response envelope** — all routes use `ok(data)` / `fail(error, status)` from `src/lib/api-response.ts`
- **Singleton Prisma client** — `src/lib/db.ts` with dev-mode query logging

## Environment Variables

Required at runtime:
```
DATABASE_URL                  # PostgreSQL connection string
AUTH_SECRET                   # Auth.js v5 secret
CREDENTIALS_ENCRYPTION_KEY    # 64-char hex string (32 bytes) for AES-256-GCM
```

## Development Environment

Uses **VSCode Dev Containers**. Services:

| Service | Purpose |
|---------|---------|
| `app` | Node.js + TypeScript dev environment |
| `db` | PostgreSQL (user: `postgres`, password: `postgres`, db: `postgres`) |
| `browserless` | Headless Chrome for E2E testing (Playwright) |

When using Playwright MCP tools, use `http://app:3000` — not `http://localhost:3000`.

## Further Documentation

- [docs/requirement.md](docs/requirement.md) — Detailed requirements (Japanese)
- [docs/rules.md](docs/rules.md) — Development rules (Japanese)
- [ADDING_A_PROVIDER.md](ADDING_A_PROVIDER.md) — Step-by-step guide for new provider adapters
- `specs/` — Feature specs with implementation plans, data models, and contracts
