# AGENTS.md

Single source of truth for AI agent guidance. `CLAUDE.md` and `.github/copilot-instructions.md` reference this file — do not duplicate.

## Project

**Sealion** — integrated TODO app aggregating issues from GitHub, GitLab, Jira, Redmine, Linear, Asana, Trello, Backlog into one list. Next.js 16 App Router + TypeScript, MUI v9, Auth.js v5 (credentials + OIDC), PostgreSQL via Prisma 7, next-intl 4 (en/ja, no locale prefix).

## Commands

```bash
npm run dev                          # Dev server http://localhost:3000
npm run build                        # Production build
npm run lint                         # ESLint — run after every code change
npm test                             # Jest (unit + integration)
npm test -- --coverage               # Coverage (95% lines threshold)
npm test -- --testPathPattern=<path> # Single test file
npx playwright test                  # E2E (requires dev server)
npx prisma migrate dev               # Apply schema migrations (CHECK DRIFT FIRST)
npx prisma db seed                   # Seed database
```

**Build order after schema changes:** `npx prisma generate` → `npm run build`

**Lint after every code change.** ESLint enforces: TSDoc on all declarations, `consistent-type-imports`, no `any`, no `console.log`, import ordering, complexity limits (`max-depth: 3`, `max-lines: 300`, `complexity: 20`).

## Architecture

### Path alias

`@/*` → `./src/*`. **No relative parent imports** (`../*` is eslint-banned).

### `src/lib/` structure (colocation by domain)

```
lib/
  api/api-response.ts       # ok(data) / fail(error, status) envelope — all API routes must use
  auth/                     # auth.ts, auth.config.ts, auth-settings.ts, bcrypt-config.ts
  db/db.ts                  # Singleton PrismaClient (PrismaPg adapter)
  encryption/               # encryption.ts, credentials.ts — AES-256-GCM for provider tokens
  email/                    # smtp-settings.ts, smtp-mailer.ts, password-reset.ts, email-verification.ts
  gravatar/gravatar.ts
  proxy/proxy.ts            # hpagent proxy config for axios
  search/                   # search-parser.ts, sort-utils.ts, date-where.ts
  sync/sync-utils.ts, error-utils.ts
  ui/theme.ts, theme-components.ts, message-queue.ts
  types.ts                  # NormalizedIssue, IssueProviderAdapter interface, SortCriterion
```

### `src/services/issue-provider/` — Adapter/Factory pattern

`IssueProviderAdapter` interface in `src/lib/types.ts`. Each provider (github, gitlab, jira, redmine, linear, asana, trello, backlog) lives in its own subdirectory with adapter + metadata. `factory.ts` creates adapters; `registry.ts` is the sole source of provider-type knowledge.

**MANDATORY: No provider-type branching outside `src/services/issue-provider/`.** Use `getProviderMetadata(type)` — never `if (type === "JIRA")`.

See `ADDING_A_PROVIDER.md` for adding new providers.

### Sync service (`src/services/sync.ts`)

Concurrency-controlled via `p-limit` (3 providers, 5 projects). External service is source of truth — upserts all returned issues. Handles rate limit errors.

### Middleware (`middleware.ts`)

Runs on every non-static request. Enforces admin-only for `/api/admin/**` and `/admin` routes.

### i18n

All UI strings in `src/messages/{en,ja}.json`. Use `useTranslations` (client) / `getTranslations` (server) — never hardcode strings.

### Notifications

Use `PageHeaderContext` + `useMessageQueue` hook for all transient notifications. **Never add standalone `Snackbar` or floating `Alert` components.**

## Domain model (Prisma)

```
User (role: USER|ADMIN, status: PENDING|ACTIVE|SUSPENDED, useGravatar)
├── BoardSettings (showCreatedAt, showUpdatedAt, sortOrder)
├── AuthSettings (singleton — allowUserSignup, requireEmailVerification, sessionTimeoutMinutes)
├── SmtpSettings (singleton — host, port, fromAddress, encryptedPassword)
├── Account (Auth.js OAuth accounts)
├── Session
└── IssueProvider (type: text, encryptedCredentials)
    └── Project (externalId, includeUnassigned, syncError)
        └── Issue (title, dueDate?, externalUrl, todayFlag, todayOrder?, pinned,
                   providerCreatedAt?, providerUpdatedAt?)
```

Key: Issue has no `status`/`priority` — closing = deleting from local DB.

## Coding Conventions

### KISS / DRY / YAGNI

Prefer simple solutions. Don't build abstractions for single use cases. Don't add features "just in case."

### Colocation

Co-locate related files by feature/domain, not by type. Hooks go with their consumers. Tests mirror source structure (`src/lib/search/` → `tests/unit/lib/search/`).

### TSDoc — mandatory on all exports

Every exported function, class, interface, type, and constant must have `/** … */` with `@param`, `@returns`, `@throws` as applicable. Enforced by `eslint-plugin-jsdoc` + `eslint-plugin-tsdoc`.

### File headers

Every `.ts`/`.tsx` file must open with a 1-2 line comment describing the file's responsibility.

### TypeScript

- `interface` for extensible shapes; `type` for unions/intersections/tuples
- No `any` — use `unknown`
- Immutable patterns: spread, `Readonly<T>`, `as const`
- Zod for input validation at system boundaries
- `consistent-type-imports` enforced (inline `import type`)

### UI / Design tokens

- Define design tokens in `src/lib/ui/theme.ts` and `theme-components.ts`
- Use **oklch** for custom colors; maintain tonal consistency with existing palette
- Design for natural eye-flow (top-left → bottom-right reading pattern)

### ADR

When making significant design decisions, write an ADR in `docs/adr/`. ADRs are **append-only** — never modify past content. If unsure whether to write one, ask the user.

### File size

200-400 lines typical, 300 max (enforced by ESLint `max-lines`).

### Error handling

Handle explicitly at every level. User-friendly messages in UI; detailed context in server logs. Never swallow errors silently.

## Testing — TDD mandatory

1. Write failing test (RED) → implement (GREEN) → refactor
2. Verify 95% line coverage with `npm test -- --coverage`

| Source | Test location |
|--------|--------------|
| `src/lib/` | `tests/unit/lib/` |
| `src/services/` | `tests/unit/services/` |
| `src/app/api/` | `tests/integration/api/` |
| Pages / components | `tests/e2e/flows/` |

Coverage excludes: pages, layouts, components, i18n, auth config, db singleton, theme, types (covered by E2E).

Integration tests: real Prisma + dev container PostgreSQL, mocked session via `jest.mock("@/lib/auth/auth")`, mocked external adapters.

## Security

- Authorization on **both** UI and API — never client-only
- Users cannot access other users' data (enforce at API layer with session userId)
- Provider credentials encrypted via `src/lib/encryption/` — never store plaintext tokens
- Never hardcode secrets — use environment variables or a secret manager
- Admin routes: middleware + re-verified in handlers

## Environment

Dev container services: `app` (Node.js), `db` (PostgreSQL: postgres/postgres/postgres), `browserless` (Playwright E2E).

Playwright MCP tools: use `http://app:3000` — not `localhost:3000`.

## Critical gotchas

- **`prisma migrate dev` can wipe the DB on schema drift.** Run `npx prisma migrate status` first. If drift detected, stop and inform user.
- **Never commit/push/PR without explicit instruction.** GitHub is read-only unless asked.
- `npm run postinstall` runs `prisma generate` automatically.
- ESLint ignores: `tests/`, `prisma/`, `specs/`, `coverage/`, `tmp/`, `src/app/**/layout.tsx`, `src/app/**/page.tsx`.

## Docs

- `docs/` — requirements, rules, development guides (Japanese)
- `specs/` — feature specs and implementation plans
- `ADDING_A_PROVIDER.md` — step-by-step guide for new adapters
- `docs/adr/` — Architecture Decision Records (append-only)

<!-- SPECKIT START
Active feature plan: specs/043-reviewer-assignee/plan.md
SPECKIT END -->

## References

- [CLAUDE.md](./CLAUDE.md) — Claude Code pointer to this file
- [.github/copilot-instructions.md](./.github/copilot-instructions.md) — Copilot pointer to this file

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
