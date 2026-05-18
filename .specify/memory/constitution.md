<!--
SYNC IMPACT REPORT
==================
Version change: 1.3.0 → 1.4.0 → 1.4.1
Modified principles:
  - V. Simplicity (YAGNI) → V. Simplicity (KISS, DRY, YAGNI):
    expanded to make KISS and DRY explicit alongside the existing YAGNI rule.
    Added explicit DRY threshold (3 occurrences) and KISS guidance.
  - VI. Code Documentation: added "file header" rule (every .ts / .tsx file MUST
    begin with a ~2-line TSDoc block stating its role and responsibility).
    Clarified TSDoc requirement covers .tsx components too.
Added principles:
  - VII. Collocation — related code MUST live together; physical proximity
    reflects logical cohesion.
  - VIII. Architecture Decision Records — significant design decisions MUST be
    recorded as ADRs under docs/adr/, append-only.
  - IX. UI Design System Coherence — design tokens MUST be used; custom colours
    MUST be authored in oklch; visual flow / 視線の流れ MUST be intentional.
Added sections:
  - Development Workflow › Documentation Reference (use docs/ ; self-describing
    filenames; ADRs live under docs/adr/).
Removed sections: None.
Minor clarifications:
  - Principle II encryption helper path corrected from `src/lib/encryption.ts` to
    `src/lib/encryption/encryption.ts` (matches actual codebase).
Templates checked:
  - .specify/templates/plan-template.md ✅ no template change needed
    (Constitution Check is dynamic against the principles in this file).
  - .specify/templates/spec-template.md ✅ no impact (spec is technology-agnostic).
  - .specify/templates/tasks-template.md ✅ no impact (categorisation unchanged).
  - .claude/skills/* ✅ no impact (skills reference principles dynamically).
Follow-up TODOs:
  - Initialise `docs/adr/` directory with `0001-record-architecture-decisions.md`
    (the canonical "we will use ADRs" ADR) and a `README.md` index — to be done
    in a separate change, not part of this constitution amendment.

---

Previous entry (1.2.3 → 1.3.0)
Modified principles:
  - III. Multi-Provider Adapter Abstraction: materially expanded with the
    Provider Type Encapsulation rules introduced by spec 030-provider-type-abstraction.
    Concrete prohibitions added (switch on type string, union literals, i18n keys keyed
    by provider type outside the service layer). Registry pattern (ProviderMetadata /
    getAllProviders / getProviderMetadata) documented as the mandatory boundary API.
Added sections: None
Removed sections: None
Templates checked:
  - .specify/templates/plan-template.md ✅ no impact (no Principle III references)
  - .specify/templates/spec-template.md ✅ no impact
  - .specify/templates/tasks-template.md ✅ no impact
Follow-up TODOs: None.

---

Previous entry (1.2.2 → 1.2.3)
Modified principles: None
Added rules:
  - Development Workflow › Database Migrations: migration files merged to develop
    MUST never be modified; safe alternative is a new additive migration.
Added sections: None
Removed sections: None
Templates checked:
  - .specify/templates/plan-template.md ✅ no impact
  - .specify/templates/spec-template.md ✅ no impact
  - .specify/templates/tasks-template.md ✅ no impact
Follow-up TODOs: None.

---

Previous entry (1.2.1 → 1.2.2)
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
- External provider credentials MUST be stored encrypted using AES-256-GCM
  (`src/lib/encryption/encryption.ts`); plaintext tokens MUST never be persisted.
- Admin routes MUST be protected in both middleware (`middleware.ts`) and inside each route handler.
- All user inputs MUST be validated at system boundaries before processing.
- Secrets (API keys, `AUTH_SECRET`, `CREDENTIALS_ENCRYPTION_KEY`) MUST be stored as environment
  variables — never hardcoded in source.

**Rationale**: The system aggregates credentials for third-party services on behalf of users.
A breach of one user's data must not cascade to others.

### III. Multi-Provider Adapter Abstraction

Issue provider integrations MUST be implemented behind a shared `IssueProviderAdapter` interface,
and provider-type identity MUST be fully encapsulated within `src/services/issue-provider/`.

#### Adapter interface

- New providers (GitHub, GitLab, Jira, Redmine, future) MUST implement the adapter interface
  defined in `src/lib/types.ts`.
- `src/services/issue-provider/factory.ts` is the single creation point; callers MUST NOT
  instantiate adapters directly.
- The domain model (`User → IssueProvider → Project → Issue`) is canonical; adapters MUST
  normalise remote data into this model.

#### Provider type encapsulation (NON-NEGOTIABLE)

All provider-type-specific logic MUST live exclusively inside `src/services/issue-provider/`.
Code outside that directory MUST NOT branch on a specific provider type string.

Each adapter MUST export a `ProviderMetadata` constant and register it via `registerProvider()`
in `src/services/issue-provider/registry.ts`. The registry functions `getAllProviders()` and
`getProviderMetadata(type)` are the sole approved boundary API for the rest of the codebase.

**Prohibited outside `src/services/issue-provider/`:**

- Conditional logic on a provider type string: `if (type === "JIRA")`, `switch (type) { case "GITHUB": … }`
- Provider type union literals: `"GITHUB" | "JIRA" | "REDMINE" | "GITLAB" | "LINEAR"`
- Hardcoded provider type arrays: `const TYPES = ["GITHUB", "JIRA", …]`
- i18n keys keyed by provider type: `t("providers.type.GITHUB")`, `t("todo.source.JIRA")`

**Required outside `src/services/issue-provider/`:**

- `getProviderMetadata(type)` — to obtain display name, icon URL, baseUrl mode, credential fields
- `metadata.baseUrlMode` — to determine URL handling behaviour (`"required"` / `"optional"` / `"none"`)
- `metadata.credentialFields` — to render or validate credential inputs generically
- `metadata.displayName` — to show the provider name in the UI (never `t("type.${type}")`)
- `getAllProviders()` — to enumerate registered providers for select lists or validation

**Adding a new provider** MUST require changes only inside `src/services/issue-provider/`:
1. Create the adapter class implementing `IssueProviderAdapter`.
2. Export a `ProviderMetadata` constant and call `registerProvider()`.
3. No changes to API routes, UI components, credential utils, or i18n files MUST be needed.

**Rationale**: Keeps the core domain clean and allows new issue trackers to be added in a single
location without rippling changes across routes, components, or translation files. Prior to
spec 030, adding a provider required changes in 10+ files; this rule holds that count to the
adapter file and its registry registration only.

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

### V. Simplicity (KISS, DRY, YAGNI)

Complexity MUST be justified; the minimum solution that satisfies current requirements is preferred.

- **YAGNI** (You Aren't Gonna Need It): Features, helpers, or abstractions MUST NOT be added for
  hypothetical future requirements. Speculative configuration knobs, feature flags for nothing,
  and generic "frameworks" awaiting a second caller are all forbidden.
- **KISS** (Keep It Simple, Stupid): The straightforward implementation MUST be chosen over a clever
  one. Cleverness that obscures intent (overloaded operators, deep generic chains, point-free
  functional gymnastics) MUST be refactored to be plainly readable.
- **DRY** (Don't Repeat Yourself): Logic repeated **three or more times** MUST be extracted to a
  shared helper, hook, or component. Two occurrences MAY remain duplicated when extracting would
  couple unrelated concerns or create a wrong abstraction — accept the duplication and revisit on
  the third occurrence.
- Functions MUST be under 50 lines; files MUST stay under 800 lines.
- Nesting MUST NOT exceed 4 levels.
- Immutable data patterns MUST be used — existing objects MUST NOT be mutated in place.
- When a simpler alternative exists, it MUST be chosen unless a documented technical reason
  demands complexity (record such justifications in the plan's Complexity Tracking table).

**Rationale**: The codebase is small and evolving quickly. KISS keeps code reviewable, DRY keeps it
maintainable, YAGNI keeps it lean. Premature abstractions create drag and obscure intent; the cost
of removing a wrong abstraction is far higher than adding one when genuinely needed.

### VI. Code Documentation

Every source file MUST carry a brief header describing its role; every exported symbol MUST be
documented with TSDoc.

- **File header (MANDATORY)**: Every `.ts` and `.tsx` file MUST begin with a TSDoc block of
  approximately 2 lines stating the file's role and responsibility. Example:
  ```ts
  /**
   * AuthProvider repository — CRUD operations against the AuthProvider table.
   * Wraps Prisma calls with AES-256-GCM encryption / decryption of clientSecret.
   */
  ```
- Every exported function, class, interface, type alias, constant, **and React component** (in
  `.ts` and `.tsx`) MUST have a TSDoc block comment (`/** … */`) immediately above its declaration.
- TSDoc comments MUST include at minimum: a one-line summary, `@param` tags for each parameter,
  and a `@returns` tag for non-void functions. React component props MUST be documented either on
  the props type or via `@param` on the component function.
- `@throws` MUST be documented when a function can throw a known error type.
- Internal (non-exported) helpers SHOULD have a brief comment when their intent is not
  immediately obvious from the name alone.
- TSDoc and file headers MUST be written in English (consistent with the Language rule in
  Development Workflow).
- Documentation MUST be kept in sync with implementation — stale or misleading comments are
  treated as bugs.

**Rationale**: The project integrates multiple external systems; clear API contracts on exported
symbols reduce onboarding time and prevent misuse across module boundaries. File headers give a
reader the file's purpose in seconds without scrolling — invaluable during code review and when
navigating a foreign module.

### VII. Collocation

Related code MUST live together; physical proximity in the filesystem MUST reflect logical cohesion.

- **Feature components** MUST be co-located with their tests, styles, sub-components, and
  feature-specific hooks. Default to placing them under the consuming route (e.g.,
  `src/app/admin/auth-providers/_components/AuthProviderForm.tsx`) rather than a top-level
  `src/components/` directory unless reused across more than one feature.
- **API route handlers** MUST live at `src/app/api/<route>/route.ts` next to any route-specific
  helpers (e.g., `_validation.ts`, `_handlers/`). Shared cross-route helpers go in
  `src/services/` or `src/lib/`.
- **Domain services** MUST live under `src/services/<domain>/` and group all related modules
  (types, schemas, factory, registry, repository) together.
- **Cross-cutting utilities** that genuinely serve more than one domain MAY live in `src/lib/`;
  introducing a new file in `src/lib/` requires confirming at least two distinct callers (DRY
  exception: only when reuse is genuine, not anticipated).
- **Tests** MUST mirror the path of the file under test: a test for
  `src/services/auth-provider/repository.ts` lives at
  `tests/unit/services/auth-provider/repository.test.ts`.

**Rationale**: Distant code increases the cost of every change — navigation, refactoring,
deletion, and review all suffer when related files are spread across the tree. Collocation
makes the blast radius of a change obvious at a glance and lets unused feature directories
be deleted as a unit when a feature is removed.

### VIII. Architecture Decision Records (ADRs)

Significant design decisions MUST be recorded as Architecture Decision Records under `docs/adr/`.

- An ADR MUST be written whenever a decision: introduces or removes a major dependency, defines
  or changes a domain boundary, picks among multiple viable architectures, alters the security
  model, sets a long-lived convention, or accepts a trade-off that future maintainers might
  otherwise question.
- When the author is uncertain whether a decision rises to the level of an ADR, the author MUST
  ask the user before proceeding rather than guess.
- ADR files MUST use the naming pattern `docs/adr/NNNN-<short-kebab-name>.md` (e.g.,
  `docs/adr/0007-dynamic-auth-providers.md`) with a monotonically increasing 4-digit prefix.
- Each ADR MUST contain: **Context**, **Decision**, **Status** (`Proposed` / `Accepted` /
  `Superseded by ADR-NNNN`), **Consequences** (positive + negative), and **Date**.
- ADRs are **append-only**. Past ADRs MUST NOT be edited (typo / formatting fixes excepted).
  A decision is reversed by writing a NEW ADR that supersedes the old one and updating the old
  ADR's Status line to `Superseded by ADR-NNNN`.
- `docs/adr/README.md` SHOULD index ADRs by number, title, and current status.

**Rationale**: ADRs preserve the *why* behind decisions that the code can never express on its
own — alternatives considered, constraints at the time, stakeholder input, performance
measurements. The append-only rule turns the directory into a reliable historical record of how
the system reached its current shape; rewriting history erases the lessons that make the
record valuable.

### IX. UI Design System Coherence

UI work MUST follow a token-based design system. Custom colours, spacing, and typography MUST
extend the token set, not bypass it.

- **Design tokens (MANDATORY)**: All colours, spacing, font sizes, radii, and shadows MUST be
  defined as tokens — MUI theme overrides, CSS custom properties, or a typed token module. Inline
  hex / rgb / px / em values are forbidden in component code; use the token (`theme.palette.*`,
  `theme.spacing(n)`, `theme.typography.*`, or the project token module).
- **Colour space**: Custom colours MUST be authored in oklch (e.g.,
  `oklch(0.62 0.18 250)`) to ensure perceptual uniformity and predictable lightness derivation.
  RGB / HSL custom colour definitions MUST NOT be introduced.
- **Tonal harmony**: A newly introduced colour MUST harmonise with the existing palette — match
  hue family, neighbouring chroma, and the existing lightness scale. Authors MUST visually
  compare against existing tokens before introducing a new one and MUST document the rationale
  (what existing token was insufficient, why) in the PR description.
- **Visual flow (視線の流れ)**: Layouts MUST guide the reader's eye with intentional hierarchy —
  primary action positioned per existing app convention (typically top-right or bottom-right),
  supporting metadata recedes via lower contrast / smaller size, related items align on a shared
  axis, and grouped controls are visually contained in a single focused region. Primary actions
  MUST NOT be scattered across multiple regions of a single view.
- Reusable visual patterns MUST be extracted into MUI theme components or shared component
  primitives once a third occurrence appears (consistent with the DRY rule in Principle V).

**Rationale**: A coherent visual language reduces cognitive load and signals product quality.
oklch gives engineers a colour space that "behaves" the way the eye perceives it — derived
shades stay harmonious without manual tweaking, and dark-mode / hover / disabled variants can
be computed mechanically. Explicit visual flow keeps power-user productivity high by letting
the eye land on the next decision without scanning.

## Technology Standards

The following technology choices are binding for all features. Deviations require a constitution
amendment.

- **Runtime**: Node.js 20 LTS / TypeScript 5
- **Framework**: Next.js 16 (App Router) — no Pages Router patterns
- **UI**: MUI v7 (Material UI) + Material Icons — no other component libraries
- **Auth**: Auth.js v5 (next-auth) with Prisma adapter; credentials-based (email/password), OIDC, and OAuth2 providers configured at runtime via the admin UI
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
   and `@throws` where applicable), and every new `.ts` / `.tsx` file carries a ~2-line file
   header (Principle VI).
7. Any decision rising to ADR-worthiness per Principle VIII has a corresponding ADR file
   (or the author has confirmed with the user that one is not needed).

### Database Migrations

- Migration files MUST never be modified once they have been merged into the `develop` branch.
- If a schema change is required after a migration is merged, a new additive migration MUST be
  created instead.
- `prisma migrate dev` MUST NOT be run without first checking for drift
  (`npx prisma migrate status`); if drift is detected, stop and inform the user before proceeding.
- Destructive schema changes (dropping columns or tables) MUST be handled in a separate,
  explicitly reviewed migration with a clear rationale.

**Rationale**: Modifying an already-merged migration rewrites history that other developers
and environments have already applied. This causes irrecoverable drift, data loss, and broken
migration chains that are extremely difficult to recover from in production.

### Documentation Reference

- The `docs/` directory contains project documentation organised by topic. Filenames are intended
  to be self-describing — authors MUST be able to identify relevant documents by filename alone.
- Before implementing a feature that touches an existing subsystem, authors SHOULD scan `docs/`
  for relevant filenames and read matching documents.
- New documentation MUST be added to `docs/` with a self-describing kebab-case filename (e.g.,
  `docs/external-auth-providers-setup.md`). Vague names like `notes.md` or `misc.md` MUST NOT
  be used.
- ADRs (Principle VIII) live under `docs/adr/` and are governed by the rules in that principle.
- Spec-Kit feature documents continue to live under `specs/<NNN-feature>/` and are out of scope
  for the `docs/` directory.

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
- New UI work MUST be visually reviewed for compliance with Principle IX (design tokens, oklch,
  visual flow) before merge.
- Decisions rising to ADR-worthiness MUST have a corresponding ADR file under `docs/adr/` or an
  explicit user confirmation that no ADR is needed.

**Version**: 1.4.1 | **Ratified**: 2026-03-20 | **Last Amended**: 2026-05-17
