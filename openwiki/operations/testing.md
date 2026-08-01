---
type: Operations and testing guide
title: Sealion operations and testing
description: "Docker deployment, Prisma migration safety, CI workflows, test layers, release automation, and OpenWiki maintenance for Sealion."
tags: [operations, testing, ci, deployment, runbook]
---

# Operations and testing

## Deploy and start

The documented operator path is Docker Compose with PostgreSQL 16, described in [`README.md`](../../README.md) and [`docker/docker-compose.yml`](../../docker/docker-compose.yml). The container entrypoint waits for PostgreSQL, runs `prisma migrate deploy`, and starts Next.js. `generate-keys` prints instructions for `AUTH_SECRET` and `CREDENTIALS_ENCRYPTION_KEY`; keep resulting values outside source control.

For schema work, run `npx prisma migrate status` before `npx prisma migrate dev`; stop on drift because development migration commands can reset data. Production startup uses `migrate deploy`. After intentional schema changes, run `npx prisma generate`, build, and affected tests.

## Test layers

| Layer | Location | Purpose |
| --- | --- | --- |
| Unit | `tests/unit/` | utilities, hooks, API branches, registries, factories, and adapters |
| Integration | `tests/integration/` | API/session/Prisma behavior and synchronization orchestration |
| E2E | `tests/e2e/` | setup, dashboard, providers/projects, Today, admin, account, and OIDC flows |

Jest uses V8 coverage and a global 95% line threshold. Playwright starts `npm run dev`, runs Chromium, uses one worker in CI, and retains traces on first retry. The practical verification matrix is: targeted unit tests for libraries/providers; integration tests for API ownership and schema behavior; E2E for visible workflows; lint and build for all consequential changes.

The [synchronization workflow](../workflows/synchronization.md) and [provider integrations](../integrations/providers.md) identify the highest-risk behavioral cases.

## CI, release, and repository state

`.github/workflows/ci.yml` runs lint, Jest/coverage, and build on Node 22. Container publishing builds AMD64 and ARM64 images on version tags or manual dispatch. Release automation tags from `package.json`, publishes images, creates a prerelease, and backmerges `main` to `develop`. Contributors are directed to submit PRs against `develop`; direct PRs to `main` are restricted by workflow policy.

At this initialization, `git status --short` reports an unstaged modification to [`.github/workflows/openwiki-update.yml`](../../.github/workflows/openwiki-update.yml). Its current workflow runs daily at 08:00 UTC or manually, installs OpenWiki 0.2.5 with Mermaid/jsdom validation, and opens an `openwiki/update` pull request. The uncommitted workflow switches to OpenRouter model `z-ai/glm-5.2` and adds LangSmith variables; do not treat those details as committed application behavior.

## Operational watch-outs

- Sync is fire-and-forget and in-process; a `202` response is not completion.
- Successful empty provider responses are destructive by design.
- Middleware does not authorize ordinary API routes; handlers must do so.
- Node versions differ between the Docker image and CI; validate runtime-sensitive upgrades.
- Never read or document `.env` or live credentials; use `.env.example` and variable names only.

## Useful commands

```bash
npm run lint
npm test -- --ci --passWithNoTests --coverage
npx playwright test
npx prisma migrate status
npx prisma generate
npm run build
docker compose up -d
docker compose stop
```
