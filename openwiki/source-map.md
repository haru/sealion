---
type: Source navigation guide
title: Sealion source map
description: "Domain-oriented navigation from common engineering changes to the smallest credible source files, tests, and repository documentation."
tags: [source-map, navigation, development, testing]
---

# Source map

Use this map to choose a focused starting point. Trace from the public route or UI interaction to its service and Prisma relation, then to the matching tests.

| Change | Start here | Follow-up |
| --- | --- | --- |
| App shell, route, or navigation | `src/app/`, `src/components/layout/`, `src/lib/ui/page-routes.ts` | matching page/API route and E2E flow |
| Dashboard search, Today, DnD, polling | `src/app/(dashboard)/page.tsx`, `src/hooks/` | `src/components/`, `src/lib/search/`, `src/lib/sync/`, `tests/e2e/` |
| Issue mutation or ownership | `src/app/api/issues/` | `src/lib/api/api-response.ts`, Prisma relations, `tests/integration/api/` |
| Provider/project setup | `src/app/api/providers/`, `src/app/api/projects/` | provider registry/factory and provider UI tests |
| Tracker behavior | `src/services/issue-provider/` | `src/services/sync.ts`, adapter unit tests, sync integration tests |
| Schema or migration | `prisma/schema.prisma`, `prisma/migrations/` | API selects, normalizers, migration status, build |
| Local login/session | `src/lib/auth/`, `src/app/api/auth/`, `middleware.ts` | auth integration and E2E tests |
| External IdP admin/linking | `src/services/auth-provider/`, `src/app/api/admin/auth-providers/` | `docs/adr/0002*`, `docs/adr/0003*`, OIDC tests |
| Encryption, email, proxy, validation | `src/lib/encryption/`, `src/lib/email/`, `src/lib/proxy/`, `src/lib/validation/` | corresponding `tests/unit/lib/` |
| Deployment and automation | `docker/`, `.github/workflows/` | `README.md`, `package.json`, operations guide |

## Repository documentation

- [`README.md`](../README.md): product overview, Docker Compose installation, external-auth setup, and updating.
- [`AGENTS.md`](../AGENTS.md): contributor conventions, commands, security rules, test mapping, and active specification pointer.
- [`ADDING_A_PROVIDER.md`](../ADDING_A_PROVIDER.md): adapter extension checklist; verify its enum wording against current source.
- [`docs/adr/`](../docs/adr/): append-only architectural decisions.
- [`docs/external-auth-providers-setup.md`](../docs/external-auth-providers-setup.md): operator detail for external authentication.
- [`specs/`](../specs/): feature specifications and implementation plans.

## Test correspondence

The normal mapping is `src/lib/` → `tests/unit/lib/`, `src/services/` → `tests/unit/services/`, API routes → `tests/integration/api/`, and page/component workflows → `tests/e2e/`. For sync/provider changes, include both adapter/service unit coverage and integration coverage for persistence and error semantics. For authentication or admin changes, test both route-level authorization and the user-facing flow; middleware is only one layer.

For conceptual explanations, continue to [architecture](./architecture/overview.md), [data model](./domain/data-model.md), [workflows](./workflows/synchronization.md), [integrations](./integrations/providers.md), or [operations](./operations/testing.md).
