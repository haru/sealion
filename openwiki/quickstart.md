# Sealion code wiki

Sealion is a self-hosted, multi-user TODO board that aggregates **open issues assigned to a user** from supported external trackers. A user configures one or more connections, selects projects, synchronizes issues into PostgreSQL, and manages a unified backlog and **Today** list. Closing an issue from Sealion closes it in the source tracker before its local row is removed.

This wiki is a navigation and maintenance guide, not a replacement for the product README. Start here, then follow the page matching the change you need to make.

## Read next

- [Architecture](./architecture.md) — application boundaries, auth, storage, and request protection.
- [Workflows and domain rules](./workflows.md) — provider setup, synchronization, task lifecycle, and identity flows.
- [Integrations](./integrations.md) — tracker adapters and runtime-configured external authentication.
- [Operations and testing](./operations-and-testing.md) — deployment, migrations, CI checks, and test placement.
- [Source map](./source-map.md) — where to start for a concrete change.

## Product model

Supported issue trackers are GitHub, GitLab, Jira, Redmine, Linear, Asana, Trello, and Backlog ([`README.md`](../README.md); [`src/services/issue-provider/registry.ts`](../src/services/issue-provider/registry.ts)). Each user owns its own provider connections, projects, issues, and board settings. Administrators additionally manage users, SMTP, login policy, and external identity providers.

The central persistence chain is:

```text
User → IssueProvider → Project → Issue
     └→ BoardSettings
```

`Issue` represents the locally cached, still-open source issue—not a historical work record. Its Today ordering and pinned flag are local board state. See [workflows](./workflows.md) and [`prisma/schema.prisma`](../prisma/schema.prisma).

## Stack and runtime shape

- **Next.js App Router + React + TypeScript** for pages and route handlers (`src/app/`).
- **PostgreSQL + Prisma** for application and Auth.js data (`prisma/`, `src/lib/db/`).
- **Auth.js** for credentials plus database-configured OAuth/OIDC providers (`src/lib/auth/`, `src/services/auth-provider/`).
- **MUI** and **next-intl** for UI and English/Japanese messages (`src/components/`, `src/messages/`).
- **Adapter/factory integration layer** for issue providers (`src/services/issue-provider/`).

## Engineer starting commands

```bash
npm run dev
npm run lint
npm test
npm test -- --coverage
npx playwright test
```

After Prisma schema work, first check migration state with `npx prisma migrate status`; only then use `npx prisma migrate dev`. Run `npx prisma generate` before `npm run build` when schema changes affect generated types. The project enforces a 95% global Jest line-coverage threshold. Details and deployment notes are in [operations and testing](./operations-and-testing.md).

## Non-negotiable change rules

1. **Protect tenant ownership in every non-admin API handler.** Middleware only centrally protects `/api/admin/**`; other API routes must authenticate and constrain queries to the session user.
2. **Treat source trackers as authoritative.** Sync upserts returned open issues and deletes no-longer-returned issues; adapters must return only the intended open scope.
3. **Never persist or log raw provider/IdP secrets.** Provider credentials and external IdP client secrets are encrypted at rest.
4. **Keep provider-specific branching inside `src/services/issue-provider/`.** Use metadata, registry, and factory seams rather than scattered `type` comparisons.
5. **Keep UI text localized** in both `src/messages/en.json` and `src/messages/ja.json`; use the shared page-header message queue for transient notifications.

These are grounded in [`AGENTS.md`](../AGENTS.md), [`src/services/sync.ts`](../src/services/sync.ts), and the API/service implementations. Existing contributor instructions remain authoritative for coding conventions.

## Repository status at wiki initialization

The initial wiki was generated against `5f71968` on branch `feature/openwiki`. The working tree already contained edits to `AGENTS.md` and `CLAUDE.md`, plus untracked OpenWiki automation/documentation files. This wiki does not interpret those uncommitted edits as product behavior.
