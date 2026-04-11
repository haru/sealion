---
applyTo: "src/services/**"
---

# Service Layer Instructions

## Issue Provider Adapters (`src/services/issue-provider/`)

### Provider Type Encapsulation — MANDATORY

All provider-type-specific logic must live inside `src/services/issue-provider/`. Code outside this directory must **never** branch on a specific provider type string.

| Allowed | Forbidden outside `src/services/issue-provider/` |
|---------|--------------------------------------------------|
| `getProviderMetadata(type)` | `if (type === "JIRA")` |
| `metadata.credentialFields` | hardcoded provider type arrays |
| `metadata.displayName` | `t("providers.type.GITHUB")` i18n keys keyed by type |

### Adding a New Provider

See [ADDING_A_PROVIDER.md](../../ADDING_A_PROVIDER.md) for the full step-by-step guide. Changes are required only inside `src/services/issue-provider/`:

1. Create the adapter class (implements `IssueProviderAdapter`)
2. Export a `ProviderMetadata` constant and call `registerProvider()`
3. Register it in `registry.ts`

### Adapter Interface

All adapters implement `IssueProviderAdapter` from `src/lib/types.ts` with methods: `testConnection()`, `listProjects()`, `fetchAssignedIssues()`, `closeIssue()`, `addComment()`.

## Sync Service (`src/services/sync.ts`)

- Concurrency-controlled via `p-limit` (3 providers, 5 projects)
- External service is source of truth — upsert all returned issues
- Handle rate limit errors; store sync timestamps and errors per project

## Test Coverage

Service changes require unit tests in `tests/unit/services/`. Mock external APIs but test business logic thoroughly.
