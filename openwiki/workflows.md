---
type: Workflow guide
title: Sealion workflows and domain rules
description: "Tracker configuration, synchronization, board lifecycle, authentication behavior, and change checklists for Sealion."
tags: [workflows, synchronization, board, authentication]
---

# Workflows and domain rules

## Configure a tracker connection

1. An authenticated user creates a provider through `POST /api/providers` ([`src/app/api/providers/route.ts`](../src/app/api/providers/route.ts)).
2. The route verifies the provider type against the registry, trims and validates an optional base URL, builds typed credentials, and calls the adapter's `testConnection()`.
3. It encrypts credentials (the base URL is stored separately), then persists the connection with the signed-in user's ID.
4. The user chooses accessible external projects through the project API; each `Project` has a provider-scoped external ID and optional `includeUnassigned` setting.

A connection is user-owned. Every create/read/update/delete path needs session-scoped access control. GitHub Enterprise support made base URLs an explicit validated connection attribute; recent provider changes should retain that distinction between remote endpoint configuration and encrypted secrets.

## Synchronize external work

The sync contract lives in [`src/services/sync.ts`](../src/services/sync.ts):

1. Load the requesting user's provider connections and selected projects.
2. Decrypt a provider's credentials and create its adapter.
3. Fetch assigned issues for each project; optionally fetch unassigned issues and deduplicate them against assigned results.
4. Upsert all normalized returned issues in a transaction.
5. Delete local issues absent from that result, then record `lastSyncedAt` and clear or persist a project-specific sync error.
6. Optionally enrich missing creation dates for adapters that implement that capability.

**Critical invariant:** the remote service is authoritative and the local database stores only issues adapters consider open. An adapter returning incomplete results can cause local rows to be deleted. Do not change an adapter's filtering, pagination, assigned/unassigned semantics, or external-ID representation without exercising sync tests.

Sync limits concurrent work to **3 providers** and **5 projects**. `POST /api/sync` intentionally returns `202` immediately and starts the in-process work; the UI polls `GET /api/sync` for project status and stored errors ([`src/app/api/sync/route.ts`](../src/app/api/sync/route.ts)). It is not a durable background-job system: process shutdown can interrupt a sync.

## Manage the board and complete work

The dashboard separates the backlog from Today tasks. Issue-list handling applies user-scoped joins, board sorting, search filters, and pinning; Today state is represented by `todayFlag`, `todayOrder`, and `todayAddedAt` in the `Issue` model.

`PATCH /api/issues/[id]` ([`src/app/api/issues/[id]/route.ts`](../src/app/api/issues/[id]/route.ts)) supports three mutation classes:

- `pinned`: locally pins or unpins an owned issue.
- `todayFlag`: locally adds/removes an owned issue from Today. Addition uses a serializable transaction so concurrent additions cannot receive the same order.
- `closed: true`: decrypts the owned connection, closes the issue remotely, optionally adds a remote comment, then deletes the local row. If the remote action fails, the local issue remains and the API returns a sanitized upstream failure.

Therefore, "complete" is an external side effect followed by a local deletion, not an internal status transition. Pins and Today fields are intentionally local and may survive normal synchronization as long as the remote issue remains open.

## Local and external authentication

Local credentials reject pending, suspended, and OIDC-only users as appropriate. Administrators configure Google, GitHub, Microsoft Entra ID, or generic OIDC in `/admin/auth-providers`; enabled records are loaded into Auth.js dynamically. Local authentication remains available alongside these providers.

Auth settings centrally control signup, email verification, and optional session lifetime. SMTP settings support password/verification mail. See [`README.md`](../README.md) and [`docs/external-auth-providers-setup.md`](../docs/external-auth-providers-setup.md) for operator-facing setup, and [architecture](./architecture.md) for the runtime design.

## Change checklist

- **New issue field:** change schema + migration, selects/types, sync normalization, board UI, localization, and unit/integration/E2E coverage.
- **Board interaction:** preserve ownership checks, stable ordering, and the shared notification pattern; put client orchestration in a hook rather than a page component.
- **Sync change:** test normal result, empty result, remote error, credential decryption failure, and concurrency/order implications.
- **Auth change:** test both credentials and external-account paths; admin middleware protection does not replace route-level checks.
