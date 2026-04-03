<!--
SYNC IMPACT REPORT
==================
Version change: 1.2.1 → 1.2.2
Modified principles:
  - III. Multi-Provider Adapter Abstraction: added GitLab to concrete provider list
    (was "GitHub, Jira, Redmine, future"; now "GitHub, GitLab, Jira, Redmine, future")
Added sections: None
Removed sections: None
Templates checked:
  - .specify/templates/plan-template.md ✅ no impact
  - .specify/templates/spec-template.md ✅ no impact
  - .specify/templates/tasks-template.md ✅ no impact
Follow-up TODOs: None.

---

Previous entry (1.2.0 → 1.2.1):
Version change: 1.2.0 → 1.2.1
Modified principles: None
Changed technology standards:
  - UI library version corrected: MUI v6 → MUI v7 (codebase already on v7; constitution was stale)
Added sections: None
Added rules: None
Removed sections: None
Templates checked:
  - .specify/templates/plan-template.md ✅ no impact
  - .specify/templates/spec-template.md ✅ no impact
  - .specify/templates/tasks-template.md ✅ no impact
Follow-up TODOs: None.

---

Previous entry (1.1.0 → 1.2.0):
Version change: 1.1.0 → 1.2.0
Modified principles: None
Added sections:
  - Principle VI. Code Documentation (TSDoc mandatory for all exported symbols)
Added rules:
  - Development Workflow › Code Quality Gates: added gate #6 "TSDoc present on all exported symbols"
-->

# Sealion Constitution

## Core Principles

### I. Test-First (NON-NEGOTIABLE)

TDD is mandatory for every code change without exception.

- A failing test MUST exist before any implementation file is touched.
- Workflow: write test → confirm RED → write minimal implementation → confirm GREEN → refactor.
- Unit and integration tests live in `tests/unit/` and `tests/integration/` (Jest).
- Pages, layouts, and React components are covered by E2E tests in `tests/e2e/` (Playwright).
- `npm test` MUST pass after every change; coverage threshold is 95% lines (enforced by Jest).
- Test files may not be written speculatively "just in case" — each test MUST map to a real
  failing requirement.

**Rationale**: Prior violations caused regressions that were hard to trace. This rule is
non-negotiable to keep the codebase trustworthy and deployable at any commit.

### II. Security by Design

Security controls MUST be applied at every layer; client-side checks alone are never sufficient.

- Every API route MUST enforce authentication and authorise the requesting user's session `userId`.
- Users MUST NOT be able to read or modify another user's data (enforced at the API layer).
- External provider credentials MUST be stored encrypted using AES-256-GCM (`src/lib/encryption.ts`);
  plaintext tokens MUST never be persisted.
- Admin routes MUST be protected in both middleware (`middleware.ts`) and inside each route handler.
- All user inputs MUST be validated at system boundaries before processing.
- Secrets (API keys, `AUTH_SECRET`, `CREDENTIALS_ENCRYPTION_KEY`) MUST be stored as environment
  variables — never hardcoded in source.

**Rationale**: The system aggregates credentials for third-party services on behalf of users.
A breach of one user's data must not cascade to others.

### III. Multi-Provider Adapter Abstraction

Issue provider integrations MUST be implemented behind a shared `IssueProviderAdapter` interface.

- New providers (GitHub, GitLab, Jira, Redmine, future) MUST implement the adapter interface
  defined in `src/lib/types.ts`.
- `src/services/issue-provider/factory.ts` is the single creation point; callers MUST NOT
  instantiate adapters directly.
- The domain model (`User → IssueProvider → Project → Issue`) is canonical; adapters MUST
  normalise remote data into this model.
- Provider-specific logic MUST remain inside the adapter and MUST NOT leak into shared services
  or API routes.

**Rationale**: Keeps the core domain clean and allows new issue trackers to be added without
changing business logic or the sync flow.

### IV. Internationalisation First

All user-visible strings MUST be externalised; hardcoded display strings are forbidden.

- Every UI string MUST live in `src/messages/en.json` (English, default) and `src/messages/ja.json`
  (Japanese).
- Components MUST use `useTranslations` / `getTranslations` from `next-intl`; direct string literals
  MUST NOT appear in JSX or returned API error messages shown to end-users.
- Locale detection follows `next-intl` configuration (prefix: `never`); URL structure MUST NOT
  include a locale segment (no `/en/`).
- New user-facing features MUST add translation keys to both locale files before merging.

**Rationale**: Japanese and English users are both first-class; retrofitting i18n after the fact
is costly and error-prone.

### V. Simplicity (YAGNI)

Complexity MUST be justified; the minimum solution that satisfies current requirements is preferred.

- Features, helpers, or abstractions MUST NOT be added for hypothetical future requirements.
- Functions MUST be under 50 lines; files MUST stay under 800 lines.
- Nesting MUST NOT exceed 4 levels.
- Immutable data patterns MUST be used — existing objects MUST NOT be mutated in place.
- When a simpler alternative exists, it MUST be chosen unless a documented technical reason
  demands complexity (record such justifications in the plan's Complexity Tracking table).

**Rationale**: The codebase is small and evolving quickly; premature abstractions create drag
and obscure intent.

### VI. Code Documentation

All exported symbols MUST be documented with TSDoc comments.

- Every exported function, class, interface, type alias, and constant MUST have a TSDoc block
  comment (`/** … */`) immediately above its declaration.
- TSDoc comments MUST include at minimum: a one-line summary, `@param` tags for each parameter,
  and a `@returns` tag for non-void functions.
- `@throws` MUST be documented when a function can throw a known error type.
- Internal (non-exported) helpers SHOULD have a brief comment when their intent is not
  immediately obvious from the name alone.
- TSDoc MUST be written in English (consistent with the Language rule in Development Workflow).
- Documentation MUST be kept in sync with implementation — stale or misleading comments are
  treated as bugs.

**Rationale**: The project integrates multiple external systems; clear API contracts on exported
symbols reduce onboarding time and prevent misuse across module boundaries.

## Technology Standards

The following technology choices are binding for all features. Deviations require a constitution
amendment.

- **Runtime**: Node.js 20 LTS / TypeScript 5
- **Framework**: Next.js 16 (App Router) — no Pages Router patterns
- **UI**: MUI v7 (Material UI) + Material Icons — no other component libraries
- **Auth**: Auth.js v5 (next-auth) with Prisma adapter; credentials-based (email/password)
- **Database**: PostgreSQL 16 via Prisma 7 ORM — raw SQL MUST only be used where Prisma cannot
  express the query
- **i18n**: next-intl 4 (locale prefix: `never`)
- **Testing**: Jest (unit + integration, 95% coverage), Playwright (E2E)
- **Linting**: ESLint extending `eslint-config-next/core-web-vitals` + `typescript` — `npm run lint`
  MUST pass after every code change
- **LLM integration** (future): LangChain — not yet in use; no other LLM SDK MUST be introduced
  without an amendment

## Development Workflow

### Git & Collaboration

- **No commit, push, or PR** MUST be created without explicit user instruction. This rule has no
  exceptions (see `CLAUDE.md`).
- GitHub MUST only be read (e.g., `gh pr view`) — never written — unless explicitly instructed.
- Commit messages MUST follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`,
  `test:`, `chore:`, `perf:`, `ci:`).
- All source code, comments, commit messages, and documentation MUST be written in English.

### Code Quality Gates (before any merge)

1. `npm test` passes with ≥ 95% line coverage.
2. `npm run lint` exits with zero errors.
3. `npm run build` exits with zero errors (type-check + compilation MUST pass after every
   implementation; run after `prisma generate` whenever the Prisma schema has changed).
4. All CRITICAL and HIGH findings from code-review addressed.
5. Security checklist cleared (no hardcoded secrets, inputs validated, auth enforced).
6. TSDoc present on all newly added or modified exported symbols (summary, `@param`, `@returns`,
   and `@throws` where applicable).

### Feature Development Order

1. Research & Reuse — search GitHub / docs before writing new code.
2. Plan — use `/speckit.plan` to produce spec, research, data-model, contracts.
3. TDD — tests first (RED → GREEN → refactor).
4. Code Review — use `code-reviewer` agent immediately after writing code.
5. Commit — only when explicitly instructed.

## Governance

This constitution supersedes all other practices documented in this repository. When a conflict
arises between this document and any other guideline, this constitution takes precedence.

### Amendment Procedure

1. Open a discussion describing the proposed change and rationale.
2. Increment the version according to semantic rules below.
3. Update this file and run the consistency propagation checklist (templates, docs, CLAUDE.md).
4. Record the change in the Sync Impact Report comment at the top of this file.
5. Commit with message: `docs: amend constitution to vX.Y.Z (<summary>)`.

### Versioning Policy

- **MAJOR**: Backward-incompatible governance change — removal or redefinition of a principle.
- **MINOR**: New principle or section added, or materially expanded guidance.
- **PATCH**: Clarifications, wording, typo fixes, non-semantic refinements.

### Compliance Review

- All PRs MUST pass the Constitution Check in `plan-template.md` before Phase 0 research begins.
- Complexity violations MUST be justified in the plan's Complexity Tracking table.
- Security and TDD compliance MUST be verified during code review on every PR.

**Version**: 1.2.2 | **Ratified**: 2026-03-20 | **Last Amended**: 2026-04-03
