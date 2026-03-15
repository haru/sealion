# AGENTS.md

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

### TDD
- Write tests before implementation (RED → GREEN → REFACTOR)
- Target **95% line coverage** (stricter than the default 80%)
- No feature code without a failing test first

### Security
- Authorization must be enforced on **both** the UI and API sides — never rely on client-side checks alone
- Users must never be able to read or modify another user's data
- Credentials for external services (GitHub tokens, Jira API keys, etc.) must be stored encrypted and scoped per user

## Development Environment

This project uses **VSCode Dev Containers**. Open in the dev container before starting development.
