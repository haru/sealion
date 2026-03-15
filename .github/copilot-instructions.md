# Copilot Instructions — Sealion

## Project Overview

**Sealion** is an integrated personal TODO management app that aggregates issues from multiple issue trackers (GitHub, Jira, Redmine) into a unified list. Future versions will use LLM (via LangChain) to summarize issues and auto-assign priorities.

**Current state:** Early-stage scaffolding — Next.js default template with dev container and database configured. No domain models or feature code yet.

## Tech Stack

- **Framework:** Next.js 16 + TypeScript (App Router)
- **UI:** MUI (Material UI) + Material Icons
- **Auth:** Auth.js
- **Database:** PostgreSQL (via dev container docker-compose)
- **LLM (future):** LangChain
- **Dev environment:** VSCode Dev Containers

## Commands

```bash
npm run dev      # Start development server on http://localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint — run this after every code change
```

Tests are configured with Jest (see `jest.config.ts` / `jest.setup.ts`). Run tests using the npm test scripts defined in `package.json`, and follow the TDD rules below when adding or updating tests.

## Project Structure

```
src/
  app/              # Next.js App Router pages and layouts
docs/
  requirement.md    # Full project requirements (Japanese)
  rules.md          # Development rules (Japanese)
public/             # Static assets
.devcontainer/      # Dev container config (Dockerfile, docker-compose, post-create.sh)
```

Path alias: `@/*` maps to `./src/*` (configured in tsconfig.json).

## Domain Architecture

```
User
└── IssueProvider (GithubProvider | RedmineProvider | JiraProvider)
    └── Project (GithubProject | RedmineProject | JiraProject)
        └── Issue (GithubIssue | RedmineIssue | JiraIssue)
```

Each `IssueProvider` holds connection settings (URL, credentials). Each `Project` maps to a repo/project within that provider. `Issue` is the normalized TODO unit displayed to the user.

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

UI text must support i18n from the start. First release targets **English** (default) and **Japanese**. Use an i18n library; never hardcode display strings.

## Testing

### TDD is Mandatory
1. Write test first (RED)
2. Run test — it should FAIL
3. Write minimal implementation (GREEN)
4. Run test — it should PASS
5. Refactor (IMPROVE)
6. Verify coverage

**Target: 95% line coverage** (project-specific, stricter than default 80%).

### Required Test Types
- **Unit tests** — individual functions, utilities, components
- **Integration tests** — API endpoints, database operations
- **E2E tests** — critical user flows (Playwright)

## Security

- Authorization must be enforced on **both** UI and API sides — never rely on client-side checks alone
- Users must never be able to read or modify another user's data
- Credentials for external services (GitHub tokens, Jira API keys, etc.) must be stored encrypted and scoped per user
- Never hardcode secrets — always use environment variables or a secret manager
- Parameterized queries only (no string-concatenated SQL)
- Sanitize all user-facing output (XSS prevention)

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
| `browserless` | Headless Chrome for E2E testing |

## Design Patterns

- **Repository Pattern** for data access (findAll, findById, create, update, delete)
- **Consistent API response envelope** with success indicator, data payload, error message, and pagination metadata
