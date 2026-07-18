---
type: Operations and testing guide
title: Sealion operations and testing
description: "Deployment, database safety, CI automation, test strategy, and operational considerations for maintaining Sealion."
tags: [operations, testing, ci, deployment]
---

# Operations and testing

## Deployment and startup

The supported operator path in [`README.md`](../README.md) is Docker Compose with PostgreSQL 16. The production image's entrypoint ([`docker/entrypoint.sh`](../docker/entrypoint.sh)) waits for PostgreSQL, runs `prisma migrate deploy`, and then starts the supplied application command. It also supports a `generate-keys` command for generating authentication and credential-encryption material; keep generated secret values out of source control and documentation.

The README documents required deployment configuration and first-admin setup. It also explains that migrations run when the container starts. For local contributor work, project commands are recorded in [`AGENTS.md`](../AGENTS.md): start the dev server, run lint/Jest/Playwright, and use Prisma commands deliberately.

### Database safety

Before `npx prisma migrate dev`, run:

```bash
npx prisma migrate status
```

Stop if it reports schema drift: development migration commands can reset data. After intentional schema changes, create the migration, regenerate Prisma client, build, and test affected paths. Production uses `migrate deploy`, not development migrations.

## CI and release signals

The checked-in CI workflow (`.github/workflows/ci.yml`) installs dependencies and runs linting, Jest/coverage, and a production build. Playwright is configured separately in [`playwright.config.ts`](../playwright.config.ts) to start `npm run dev` and run Chromium E2E tests. Additional workflows build containers, prevent inappropriate main-branch PRs, and manage release-tag backmerge.

[`openwiki-update.yml`](../.github/workflows/openwiki-update.yml) runs manually or daily at 08:00 UTC, checks out the triggering ref without a ref pin, uses Node 22, and runs OpenWiki with OpenRouter's `z-ai/glm-5.2`. LangSmith tracing is enabled for the `openwiki` project. It opens or updates an `openwiki/update` PR containing `openwiki`, `AGENTS.md`, `CLAUDE.md`, and `.github/workflows/openwiki-update.yml`; no explicit PR base branch is configured.

Recent history is mostly dependency maintenance, but the recent product changes reveal active risk areas:

- provider base-URL validation and GitHub Enterprise support;
- remote pagination and GitLab merge-request identity handling;
- reviewer-assigned GitHub/GitLab work;
- runtime external authentication and its administrator controls.

For changes in those areas, use the existing test coverage rather than assuming a happy-path manual check is sufficient.

## Test strategy

| Layer | Location | What it protects |
| --- | --- | --- |
| Unit | `tests/unit/` | utilities, API decision branches, adapters, factories/registries, hooks/components. |
| Integration | `tests/integration/` | API/session/Prisma behavior, auth account linkage, and sync orchestration. |
| E2E | `tests/e2e/` | dashboard, providers/projects, Today drag/drop, settings, admin, and OIDC flows. |

Jest collects `tests/unit` and `tests/integration`; its configuration excludes page/layout/component coverage because those flows are exercised via E2E. The global line threshold is **95%** ([`jest.config.ts`](../jest.config.ts)). Tests use real development PostgreSQL for integration scenarios and mock external trackers/sessions where appropriate.

### Practical verification matrix

- **Pure library/provider change:** targeted unit test, then `npm test` and `npm run lint`.
- **API or ownership change:** integration tests for unauthenticated, cross-user, validation, and error cases.
- **Schema change:** migration-status check, migration/generate/build, affected integration tests, and E2E if UI-visible.
- **User workflow/UI change:** relevant E2E spec plus localization checks in both message files.
- **Authentication/admin change:** test route-level auth and role behavior; middleware is only one layer.

## Operational watch-outs

- Sync is in-process fire-and-forget. A `202` response means it was started, not that every project finished. Inspect poll results/project error state when diagnosing a missing issue.
- Sync failures are persisted per project and technical remote error details are intentionally sanitized before user-facing storage/response.
- Docker runtime and CI use different Node major versions in the current repository configuration (production image 24; CI workflow 22). Treat upgrades affecting Node/Next/Prisma as needing build and runtime validation.
- Do not read, commit, or copy `.env`/live credential files. Use templates and named environment variables only.
