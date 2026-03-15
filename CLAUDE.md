# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sealion** is an integrated personal TODO management app that aggregates issues from multiple issue trackers (GitHub, Jira, Redmine) into a unified list. Future versions will use LLM (via LangChain) to summarize issues and auto-assign priorities.

## Tech Stack

- **Framework**: Next.js 16 + TypeScript (App Router)
- **UI**: MUI (Material UI) + Material Icons
- **Auth**: Auth.js
- **Database**: PostgreSQL
- **LLM** (future): LangChain

## Commands

```bash
npm run dev      # Start development server on http://localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint — run this after every code change
```

No test runner is configured yet. When adding one, follow the TDD rules below.

## Domain Architecture

The core domain model uses inheritance to support multiple issue providers:

```
User
└── IssueProvider (GithubProvider | RedmineProvider | JiraProvider)
    └── Project (GithubProject | RedmineProject | JiraProject)
        └── Issue (GithubIssue | RedmineIssue | JiraIssue)
```

Each `IssueProvider` holds connection settings (URL, credentials). Each `Project` maps to a repo/project within that provider. `Issue` is the normalized TODO unit displayed to the user.

## Development Rules

### Language
All source code, comments, commit messages, and documentation (including this file) must be written in **English**. The project is intended to be open-source.

### Internationalization
UI text must support i18n from the start. First release targets **English** (default) and **Japanese**. Use an i18n library; never hardcode display strings.

### ESLint
Run `npm run lint` after every code change. ESLint config extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`.

### TDD — MANDATORY, NO EXCEPTIONS

> **This rule has been violated repeatedly. It is non-negotiable.**

**STOP. Before touching any implementation file, ask yourself: "Does a failing test exist for this change?"**
If the answer is no — write the test first. Only then write or modify implementation code.

The strict order is:

1. **Write the test** — it must fail (`npm test` should show RED)
2. **Write the minimal implementation** to make it pass (GREEN)
3. **Refactor** if needed, keeping tests green

**Concrete rules:**
- Adding a new function → write a failing test for it first
- Changing a function's interface (adding/removing parameters, changing types) → update the test first, confirm RED, then change the implementation
- Fixing a bug → write a failing test that reproduces the bug first
- Reviewing external feedback (e.g. Copilot suggestions) → update tests first, then apply the fix

**Never do this:**
```
❌ Change implementation → tests break → fix tests
```

**Always do this:**
```
✅ Update/add tests → confirm RED → change implementation → confirm GREEN
```

- Target **95% line coverage**
- Run `npm test` after every change and confirm all tests pass before moving on

### Security
- Authorization must be enforced on **both** the UI and API sides — never rely on client-side checks alone
- Users must never be able to read or modify another user's data
- Credentials for external services (GitHub tokens, Jira API keys, etc.) must be stored encrypted and scoped per user

## Development Environment

This project uses **VSCode Dev Containers**. Open in the dev container before starting development.

## Active Technologies
- TypeScript 5.x / Node.js 22 LTS (001-integrated-todo-management)
- PostgreSQL 16 (Prisma ORM経由) (001-integrated-todo-management)

## Recent Changes
- 001-integrated-todo-management: Added TypeScript 5.x / Node.js 22 LTS
