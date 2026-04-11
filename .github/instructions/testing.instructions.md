---
applyTo: "tests/**"
---

# Testing Instructions

## TDD Workflow (strict order)

1. **RED** — Write the test first. Run `npm test` and verify it **fails**.
2. **GREEN** — Write minimal implementation. Run `npm test` and verify it **passes**.
3. **REFACTOR** — Clean up while keeping tests green.
4. **COVERAGE** — Run `npm test -- --coverage` and verify **95% line coverage**.

## Test Placement

| Change location | Test location |
|----------------|---------------|
| `src/lib/` | `tests/unit/lib/` |
| `src/services/` | `tests/unit/services/` |
| `src/app/api/` | `tests/integration/api/` |
| Pages / components | `tests/e2e/flows/` |

## Integration Tests (`tests/integration/`)

- Use real Prisma + test database (same dev container PostgreSQL)
- Mock session via `jest.mock` on `@/lib/auth`
- Mock external adapters (GitHub, Jira, Redmine, etc.)
- Create test user in `beforeAll`, clean up in `afterAll`
- All API tests should validate the `{ data, error }` response envelope

## E2E Tests (`tests/e2e/`)

- Use Playwright with the `browserless` container
- Use `http://app:3000` — not `http://localhost:3000`
- Cover critical user flows: login, sync, provider management, today tasks

## Reminders

- Fix the **implementation**, not the test (unless the test itself is wrong)
- Mock external dependencies but use real Prisma + test database for integration tests
- Never skip the RED step — if the test passes immediately, it's not testing the new behavior
