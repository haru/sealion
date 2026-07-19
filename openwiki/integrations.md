---
type: Integration reference
title: Sealion integrations
description: "Issue-tracker adapters, runtime-configured external identity providers, and safeguards for extending Sealion integrations."
tags: [integrations, issue-providers, authentication, security]
---

# Integrations

## Issue providers

The issue-provider layer isolates tracker-specific APIs behind the `IssueProviderAdapter` contract in [`src/lib/types.ts`](../src/lib/types.ts). Each built-in provider has a directory under [`src/services/issue-provider/`](../src/services/issue-provider/) containing its adapter and client-safe metadata:

- GitHub (including configurable GitHub Enterprise endpoint)
- GitLab
- Jira
- Redmine
- Linear
- Asana
- Trello
- Backlog

[`registry.ts`](../src/services/issue-provider/registry.ts) is the central metadata catalog; [`factory.ts`](../src/services/issue-provider/factory.ts) creates the runtime adapter and carries the typed credential union. API routes and UI metadata consumers must use these seams. Do not add tracker-type conditionals outside this area.

### Adapter contract

An adapter must test credentials, list projects, fetch assigned/unassigned **open** issues, close an issue, and add a comment. It converts remote data into `NormalizedIssue`:

```text
externalId, title, dueDate, externalUrl, isUnassigned,
providerCreatedAt, providerUpdatedAt
```

The sync service uses `externalId` as the project-scoped identity and removes local records not present in the adapter's latest result. Pagination and identity transformations are therefore correctness concerns, not merely performance details. Recent GitHub/GitLab history added pagination, reviewer-assigned work, and a merge-request ID prefix to avoid ambiguous identifiers; follow existing adapter tests when changing remote queries.

### Add or change a provider

[`ADDING_A_PROVIDER.md`](../ADDING_A_PROVIDER.md) is the implementation checklist. In current code, provider type is a registry-validated **string** stored by `IssueProvider.type`—the guide's reference to matching a Prisma enum is stale after the enum's removal. The practical change set is:

1. Add provider metadata (credential schema, UI fields, icon, base-URL mode) and adapter under a new provider directory.
2. Register metadata in `registry.ts` and construct the adapter in `factory.ts`.
3. Add translations for any new credential labels in both message catalogs.
4. Add unit tests for normalization, connection/error behavior, factory/registry wiring, and sync behavior; add E2E coverage for configuration if user-facing.
5. Ensure tokens are never returned, logged, or stored unencrypted.

## External identity providers

The separate [`src/services/auth-provider/`](../src/services/auth-provider/) layer maps `AuthProvider` database records to Auth.js provider builders. It has metadata/registry, schemas, repository functions, and account-linking logic. Supported types are generic OIDC, Google, GitHub, and Microsoft Entra.

The admin API stores client secrets encrypted. On auth requests, `src/lib/auth/auth.ts` reads enabled records and prepends the static credentials provider. The motivation and cache/invalidation approach are in [ADR 0002](../docs/adr/0002-dynamic-auth-provider-loading.md); account-linking safeguards are in [ADR 0003](../docs/adr/0003-reuse-authjs-account-table.md).

### Safeguards

- Do not replace explicit external account linking with automatic email linking; the current flow requires verified email handling.
- Keep IdP metadata separate from persisted configuration and never expose encrypted secrets through API responses.
- Changes that affect identity-provider behavior need integration and E2E coverage, especially login, account linking/unlinking, and admin enable/disable behavior.

## Other external boundaries

- SMTP configuration is administratively managed and used for email verification/password-reset flows.
- HTTP clients use proxy helpers under [`src/lib/proxy/`](../src/lib/proxy/) where applicable.
- Runtime configuration is environment-backed. Read samples such as [`.env.example`](../.env.example) or deployment docs, but never commit or document live secret values.
