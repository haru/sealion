# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Canonical source:** All project guidance lives in [AGENTS.md](./AGENTS.md).
> This file exists for Claude Code discovery. Do not duplicate content here — read AGENTS.md instead.

- **Framework**: Next.js 16 + TypeScript (App Router)
- **UI**: MUI (Material UI) v7 + Material Icons + dnd-kit + @mui/x-data-grid
- **Database**: PostgreSQL 16 via Prisma 7 ORM
- **i18n**: next-intl 4 — locales: `en` (default), `ja`

## Quick Commands

```bash
npm run dev          # Dev server
npm run build        # Production build
npm run lint         # ESLint
npm test             # Jest (unit + integration)
npm test -- --coverage
npx playwright test  # E2E tests
```

See [AGENTS.md](./AGENTS.md) for full architecture, coding conventions, testing rules, and security guidelines.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
[specs/044-ghe-url-support/plan.md](specs/044-ghe-url-support/plan.md)
<!-- SPECKIT END -->

## Active Technologies
- TypeScript 5 / Node.js 20 LTS + Next.js 16 (App Router), MUI v7, Auth.js v5 (next-auth), Prisma 7, next-intl 4, Zod, bcryptjs
- PostgreSQL 16 via Prisma 7 ORM

## Recent Changes
- 041-oidc-authentication: Added OIDC / OAuth2 external auth (Google / GitHub / Microsoft Entra / generic OIDC) with admin UI for IdP management; existing local credentials auth preserved
- 039-gravatar-integration: Added Gravatar support (`useGravatar` boolean column on `User`)
- 040-unify-profile-save: Unified profile settings form (username, Gravatar, password in one PATCH request)
