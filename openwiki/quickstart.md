---
type: Project overview
title: Sealion code wiki
description: "An engineer-focused map of Sealion's product model, runtime architecture, workflows, integrations, operations, testing, and source navigation."
tags: [overview, quickstart, sealion, development]
---

# Sealion code wiki

Sealion is a self-hosted, multi-user TODO application that aggregates open issues assigned to a user from GitHub, GitLab, Jira, Redmine, Linear, Asana, Trello, and Backlog. Users configure connections, select projects, synchronize normalized issues into PostgreSQL, and manage a backlog plus a Today list.

This wiki is a source-grounded navigation layer over the repository, not a replacement for the product installation guide in [`README.md`](../README.md). Start with the page matching your change:

- [Architecture overview](./architecture/overview.md) — Next.js boundaries, authorization, Auth.js, persistence, and encryption.
- [Data model and task lifecycle](./domain/data-model.md) — ownership graph, board state, and what completion means.
- [Synchronization workflows](./workflows/synchronization.md) — provider setup, reconciliation, polling, and failure behavior.
- [Issue-provider integrations](./integrations/providers.md) — adapter contract, provider-specific hazards, and extension steps.
- [Operations and testing](./operations/testing.md) — Docker, Prisma migrations, CI, release signals, and test strategy.
- [Source map](./source-map.md) — practical file-to-change navigation.

## Product and runtime shape

The application is a Next.js 16 App Router + TypeScript service using React/MUI, Auth.js v5, PostgreSQL through Prisma 7, and `next-intl` for English/Japanese UI. The central product relationship is `User → IssueProvider → Project → Issue`, with per-user `BoardSettings`. Remote trackers are authoritative for whether an issue remains open; local fields represent board organization such as Today ordering and pinning.

Read [the data model](./domain/data-model.md) for entity meaning and [the architecture overview](./architecture/overview.md) for request boundaries. Read [integrations](./integrations/providers.md) before changing provider behavior: external-ID stability and complete pagination protect local reconciliation.

## Engineer commands

```bash
npm run dev
npm run lint
npm test
npm test -- --coverage
npx playwright test
npx prisma migrate status
npx prisma generate
npm run build
```

After schema work, check migration status before `npx prisma migrate dev`; development migration commands can reset data on drift. The global Jest line threshold is 95%. See [operations and testing](./operations/testing.md) for verification by change type and Docker commands.

## Non-negotiable safeguards

1. **Enforce tenant ownership in every ordinary API handler.** Middleware checks admin paths, but other `/api/**` routes pass through and must call `auth()` plus session-scoped Prisma filters.
2. **Treat remote trackers as authoritative.** A successful sync upserts returned open issues and deletes local issues absent from that result.
3. **Protect secrets.** Provider credentials, IdP client secrets, and SMTP passwords are encrypted at rest and must never be logged or returned.
4. **Use integration seams.** Keep tracker branching inside `src/services/issue-provider/`; use its registry and factory rather than scattered type checks.
5. **Localize UI text.** Add user-facing messages to both `src/messages/en.json` and `src/messages/ja.json`.
6. **Use existing notification and API conventions.** Transient UI messages go through `PageHeaderContext`/`useMessageQueue`; APIs use the shared response helpers.

These rules are supported by [`AGENTS.md`](../AGENTS.md), [`prisma/schema.prisma`](../prisma/schema.prisma), and current service implementations.

## Git context at initialization

The repository is at commit `6683685b73168f102e4544103bbed68855791f0d`. Recent history is primarily dependency maintenance, provider hardening, external authentication, and documentation automation. High-signal provider changes added bounded pagination, reviewer-assigned GitHub/GitLab work, GitLab merge-request ID prefixes, and GitHub Enterprise base-URL support. The working tree has an unstaged modification to [`.github/workflows/openwiki-update.yml`](../.github/workflows/openwiki-update.yml); [operations and testing](./operations/testing.md) records it as working-tree state rather than committed application behavior.

## Backlog

- **Dashboard/UI detail:** `src/app/(dashboard)/page.tsx` and `src/components/` contain substantial interaction behavior; the initial wiki maps the workflow but defers a dedicated UI page to keep the first set concise.
- **Email and account lifecycle:** `src/lib/email/` and account APIs are represented in architecture and source map but not given a dedicated workflow page; expand if password reset, verification, or account deletion becomes the change focus.
- **Feature specifications:** `specs/` contains active and historical plans; consult the pointer in `AGENTS.md` before implementing an in-progress feature.