---
type: Integration reference
title: Sealion issue-provider integrations
description: "Adapter contracts, provider registry and factory behavior, supported trackers, credential boundaries, and extension guidance for Sealion integrations."
tags: [integrations, issue-providers, adapters, security]
---

# Issue-provider integrations

## Adapter boundary

[`src/lib/types.ts`](../../src/lib/types.ts) defines `IssueProviderAdapter`. Required operations test credentials, list projects, fetch assigned and unassigned open issues, close issues, and add comments. Adapters normalize remote records into `NormalizedIssue` with stable `externalId`, title, dates, URL, assignment state, and provider timestamps.

The registry in [`src/services/issue-provider/registry.ts`](../../src/services/issue-provider/registry.ts) exposes client-safe metadata for GitHub, GitLab, Jira, Redmine, Linear, Asana, Trello, and Backlog. [`factory.ts`](../../src/services/issue-provider/factory.ts) constructs runtime adapters from the persisted type string and decrypted credentials. Metadata alone is not enough: the factory switch, credential union, locale labels, and tests must also be updated.

The [synchronization workflow](../workflows/synchronization.md) consumes this contract and deletes local records not returned. The [data model](../domain/data-model.md) explains why external-ID stability is a persistence concern.

## Provider-specific correctness

- **GitHub:** supports GitHub Enterprise base URLs, bounded pagination, assigned issues, and individually reviewer-requested pull requests.
- **GitLab:** supports self-hosted URLs, bounded `x-next-page` pagination, assigned/reviewer merge requests, and `mr-` prefixes to keep merge-request IDs distinct from issue IDs.
- **Trello:** can enrich missing creation dates through card actions; enrichment failures are best effort.
- **Linear, Jira, Redmine, Asana, and Backlog:** implement the same normalized contract through their adapter directories.

Pagination bounds, reviewer semantics, base URL validation, and external-ID transformations are recurring themes in recent history (`b26b4db`, `ec42653`, `dfc10cf`, `53dcff6`, `1d3adcd`). Do not change them without provider-specific tests because incomplete results can cause destructive local deletion.

## Add or change a provider

Use [`ADDING_A_PROVIDER.md`](../../ADDING_A_PROVIDER.md), while checking it against current source: `IssueProvider.type` is a string, not a Prisma enum. The practical sequence is:

1. Add metadata and a client-safe credential schema.
2. Implement every adapter operation and stable normalization.
3. Register metadata in `registry.ts`.
4. Extend credentials and add a `factory.ts` branch.
5. Add English and Japanese credential labels.
6. Test connection errors, pagination, assigned/unassigned merging, normalization, close/comment routing, IDs, and base URLs.
7. Run unit, integration, lint, build, and relevant E2E checks.

Keep provider-specific branches in this directory. Never return or log raw credentials; API routes encrypt them before persistence and decrypt only on the server.

## Other integration boundary

External identity providers use the separate [`src/services/auth-provider/`](../../src/services/auth-provider/) registry and repository layer. SMTP is configured administratively for email flows. The [architecture overview](../architecture/overview.md) documents the dynamic Auth.js loading and encryption boundaries.
