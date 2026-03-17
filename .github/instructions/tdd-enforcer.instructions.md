---
applyTo: "**"
---

# TDD Enforcer

## Rule: No implementation without a failing test

Before modifying or creating any implementation file under `src/`, confirm that a corresponding failing test exists.

### Workflow (strict order)

1. **RED** — Write the test first in `tests/unit/`, `tests/integration/`, or `tests/e2e/`.
   Run `npm test` (or `npx playwright test` for E2E) and verify the test **fails**.
2. **GREEN** — Write the minimal implementation to make the test pass.
   Run `npm test` again and verify the test **passes**.
3. **REFACTOR** — Clean up while keeping tests green.
4. **COVERAGE** — Run `npm test -- --coverage` and verify **95% line coverage** is maintained.

### What counts as "implementation"

- New functions, classes, or modules in `src/`
- Bug fixes that change behavior in `src/`
- New API routes in `src/app/api/`
- New service logic in `src/services/`

### What is exempt

- Pages, layouts, and React components (`src/app/**/page.tsx`, `src/app/**/layout.tsx`, `src/components/`) — covered by E2E tests
- Pure config files (`next.config.ts`, `eslint.config.mjs`, `tsconfig.json`)
- i18n message files (`src/messages/*.json`)
- Type-only files (`src/types/`)
- Documentation and specs

### Test placement

| Change location | Test location |
|----------------|---------------|
| `src/lib/` | `tests/unit/lib/` |
| `src/services/` | `tests/unit/services/` |
| `src/app/api/` | `tests/integration/api/` |
| Pages / components | `tests/e2e/flows/` |

### Reminders

- Never skip the RED step — if the test passes immediately, the test is not testing the new behavior.
- Fix the implementation, not the test (unless the test itself is wrong).
- Mock external dependencies (GitHub/Jira/Redmine APIs) but use real Prisma + test database for integration tests.
- Run `npm test -- --coverage` before considering work complete.
