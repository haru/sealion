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
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->

## Active Technologies
- TypeScript 5 / Node.js 20 LTS + Next.js 16 (App Router), MUI v7, Auth.js v5 (next-auth), Prisma 7 (039-gravatar-integration)
- PostgreSQL 16 via Prisma 7 ORM — one new boolean column on `User` (039-gravatar-integration)

## Recent Changes
- 039-gravatar-integration: Added TypeScript 5 / Node.js 20 LTS + Next.js 16 (App Router), MUI v7, Auth.js v5 (next-auth), Prisma 7
