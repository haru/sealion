# Copilot Instructions — Sealion

## Project Overview

**Sealion** is an integrated personal TODO management app that aggregates issues from multiple issue trackers (GitHub, Jira, Redmine) into a unified list. Future versions will use LLM (via LangChain) to summarize issues and auto-assign priorities.

## Tech Stack

- **Framework:** Next.js 16 + TypeScript (App Router)
- **UI:** MUI (Material UI) + Material Icons
- **Auth:** Auth.js (next-auth v5) with Prisma adapter — credentials-based (email/password)
- **Database:** PostgreSQL 16 via Prisma ORM
- **i18n:** next-intl — locales: `en` (default), `ja`; locale prefix: never (no `/en/` in URLs)
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

## Domain Architecture (Prisma)

```
User (email, passwordHash, role: ADMIN | USER)
└── IssueProvider (type: GITHUB | JIRA | REDMINE, encryptedCredentials)
    └── Project (externalId, displayName, isEnabled, lastSyncedAt, syncError)
        └── Issue (externalId, title, status: OPEN | CLOSED,
                   priority: LOW | MEDIUM | HIGH | CRITICAL, dueDate, externalUrl)
```

Each `IssueProvider` holds connection settings (URL, encrypted credentials). Each `Project` maps to a repo/project within that provider. `Issue` is the normalized TODO unit displayed to the user.

## Key Architecture

### Issue Provider Adapter Pattern (`src/services/issue-provider/`)

Interface `IssueProviderAdapter` (defined in `src/lib/types.ts`) is implemented by `GitHubAdapter`, `JiraAdapter`, `RedmineAdapter`. `factory.ts` creates the right adapter from `ProviderType` + decrypted credentials. Methods: `testConnection()`, `listProjects()`, `fetchAssignedIssues()`, `closeIssue()`, `reopenIssue()`.

### Sync Service (`src/services/sync.ts`)

Concurrency-controlled syncing using `p-limit` (3 providers, 5 projects). External service is source of truth — upserts all returned issues. Handles rate limit errors; stores sync timestamps and error messages per project.

### API Response Envelope (`src/lib/api-response.ts`)

All API routes return `{ data: T | null, error: string | null }` using `ok(data)` / `fail(error, status)` helpers.

### Credential Encryption (`src/lib/encryption.ts`)

AES-256-GCM with format `iv:authTag:ciphertext` (base64). Key from `CREDENTIALS_ENCRYPTION_KEY` env var (64-char hex = 32 bytes).

### Middleware (`middleware.ts`)

Enforces admin-only access to `/api/admin/**` (checks `role === "ADMIN"`), i18n locale detection on non-API routes, and authentication for protected pages.

### Auth (`src/lib/auth.ts` + `src/lib/auth.config.ts`)

Credentials-based with bcryptjs password hashing, JWT sessions (30-day max age), session callbacks attach `user.id` and `user.role`.

## Coding Conventions

### Language
All source code, comments, commit messages, and documentation must be written in **English**.

### TypeScript Style
- Use `interface` for extensible object shapes; `type` for unions/intersections/tuples
- Avoid `any` — use `unknown` instead
- Prefer immutable patterns: spread operators, `Readonly<T>`, `as const`
- Use Zod for input validation at system boundaries
- React components use named prop interfaces (e.g., `interface ButtonProps`)
- No JSDoc unless absolutely necessary — prefer self-documenting code
- Do not use `console.log` in production code

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

## Internationalization (i18n)

All UI strings live in `src/messages/en.json` and `src/messages/ja.json`. Use `useTranslations` (client) or `getTranslations` (server) from next-intl — never hardcode display strings.

## Testing

### TDD is Mandatory
1. Write test first (RED)
2. Run test — it should FAIL
3. Write minimal implementation (GREEN)
4. Run test — it should PASS
5. Refactor (IMPROVE)
6. Verify coverage

**Target: 95% line coverage** (enforced by Jest). Pages, layouts, components, and i18n files are excluded from Jest coverage — they are covered by E2E tests instead.

### Test Placement
- **Unit tests** (`tests/unit/`) — functions, utilities, services
- **Integration tests** (`tests/integration/`) — API endpoints with real database
- **E2E tests** (`tests/e2e/`) — critical user flows (Playwright, uses `browserless` container)

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

## Environment Variables

Required at runtime:
```
DATABASE_URL                  # PostgreSQL connection string
NEXTAUTH_SECRET               # Auth.js secret
CREDENTIALS_ENCRYPTION_KEY    # 64-char hex string (32 bytes) for AES-256-GCM
```

## ESLint

Run `npm run lint` after every code change. Config extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.

## Git Workflow

- Commit message format: `<type>: <description>` (feat, fix, refactor, docs, test, chore, perf, ci)
- Git Flow branching model (git-flow is installed in the dev container)

## Dev Container Services

| Service | Purpose |
|---------|---------|
| `app` | Node.js + TypeScript dev environment |
| `db` | PostgreSQL (user: `postgres`, password: `postgres`, db: `postgres`) |
| `browserless` | Headless Chrome for E2E testing (Playwright) |

## Design Patterns

- **Adapter / Factory Pattern** for issue providers — add new providers by implementing `IssueProviderAdapter` and registering in `factory.ts`
- **Consistent API response envelope** — all routes use `ok(data)` / `fail(error, status)` from `src/lib/api-response.ts`
- **Singleton Prisma client** — `src/lib/db.ts` with dev-mode query logging
