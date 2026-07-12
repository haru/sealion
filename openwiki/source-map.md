# Source map

Use this page to choose the smallest credible starting area for a change. It intentionally maps domains rather than every source file.

| Need | Start here | Follow-up evidence |
| --- | --- | --- |
| Page, route, or navigation change | [`src/app/`](../src/app/) | Dashboard pages, auth route group, admin pages, and matching `/api` route. |
| Board UI, DnD, search, sync polling | [`src/components/`](../src/components/), [`src/hooks/`](../src/hooks/) | [`src/app/(dashboard)/page.tsx`](../src/app/(dashboard)/page.tsx), E2E flow tests. |
| Issue mutation / API ownership | [`src/app/api/issues/`](../src/app/api/issues/) | [`src/lib/api/api-response.ts`](../src/lib/api/api-response.ts), integration tests. |
| Provider connection or project setup | [`src/app/api/providers/`](../src/app/api/providers/), [`src/app/api/projects/`](../src/app/api/projects/) | [`src/services/issue-provider/`](../src/services/issue-provider/), provider UI tests. |
| Remote tracker behavior | [`src/services/issue-provider/`](../src/services/issue-provider/) | [`src/services/sync.ts`](../src/services/sync.ts), `tests/unit/services/issue-provider/`, sync integration tests. |
| Sync semantics/errors | [`src/services/sync.ts`](../src/services/sync.ts), [`src/lib/sync/`](../src/lib/sync/) | `POST/GET /api/sync`, `Project.syncError`, sync tests. |
| Schema/data migration | [`prisma/schema.prisma`](../prisma/schema.prisma), [`prisma/migrations/`](../prisma/migrations/) | API selects, normalizers, migration status, generated client/build. |
| Local login/session policy | [`src/lib/auth/`](../src/lib/auth/), auth API routes | [`middleware.ts`](../middleware.ts), auth integration/E2E tests. |
| External IdP administration/linking | [`src/services/auth-provider/`](../src/services/auth-provider/), [`src/app/api/admin/auth-providers/`](../src/app/api/admin/auth-providers/) | ADRs 0002/0003 and OIDC/account-link tests. |
| Encryption/email/proxy/shared validation | [`src/lib/encryption/`](../src/lib/encryption/), [`src/lib/email/`](../src/lib/email/), [`src/lib/proxy/`](../src/lib/proxy/), [`src/lib/validation/`](../src/lib/validation/) | Unit tests colocated under `tests/unit/lib/`. |
| Copy, locale behavior, theme/notifications | [`src/messages/`](../src/messages/), [`src/i18n/`](../src/i18n/), [`src/lib/ui/`](../src/lib/ui/) | Both locale files; `PageHeaderContext`/message queue conventions. |
| Container/CI/release behavior | [`docker/`](../docker/), [`.github/workflows/`](../.github/workflows/) | [`README.md`](../README.md), [`package.json`](../package.json), [operations](./operations-and-testing.md). |

## Documentation and decision records

- [`README.md`](../README.md) / `README.ja.md` — product overview and Docker Compose installation.
- [`AGENTS.md`](../AGENTS.md) — contributor/agent conventions, test commands, coding rules, and current feature-plan pointer.
- [`ADDING_A_PROVIDER.md`](../ADDING_A_PROVIDER.md) — provider extension checklist; verify its Prisma-enum wording against current source.
- [`docs/adr/`](../docs/adr/) — append-only architectural decisions.
- [`docs/external-auth-providers-setup.md`](../docs/external-auth-providers-setup.md) — external authentication setup detail.
- [`specs/`](../specs/) — feature-specific specifications and implementation plans; consult the active plan pointer in `AGENTS.md` before changing in-progress work.

## Test mapping

The normal correspondence is `src/lib/` → `tests/unit/lib/`, `src/services/` → `tests/unit/services/`, API routes → `tests/integration/api/`, and page/component workflows → `tests/e2e/`. Existing tests also cover explicit regressions such as GitHub Enterprise provider configuration, search, pinning, Today ordering, sync throttling, OIDC login, and admin settings.

When unsure where a business rule lives, trace from the public route/UI interaction to the service and Prisma relation; the API handler is usually the ownership boundary, while the service owns integration semantics.
