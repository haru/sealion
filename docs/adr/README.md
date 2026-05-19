# Architecture Decision Records (ADRs)

This directory holds the **Architecture Decision Records** for Sealion. ADRs capture *why* a significant design choice was made — the context, the alternatives, and the consequences — so future contributors can understand the shape of the codebase without having to dig through old PRs.

The practice is mandated by Constitution v1.4.0 **Principle VIII (Architectural Decision Records)**.

## When to write an ADR

Write an ADR for any decision that:

- introduces a new core dependency, framework, or runtime;
- changes the persistence model, authentication model, or other cross-cutting concern;
- selects between competing architectural patterns (e.g. server vs. client component, monolith vs. service split);
- reverses or supersedes a previously accepted ADR;
- locks in a security boundary or compliance posture.

When in doubt, write one. A ten-minute ADR is cheaper than a year of "I don't know why we did this."

## File layout

```
docs/adr/
  README.md                                          ← this file (index)
  0001-record-architecture-decisions.md              ← meta-ADR
  NNNN-<short-kebab-name>.md                         ← each subsequent ADR
```

- **Numbering**: zero-padded 4-digit, strictly monotonic. Never reuse a number.
- **Naming**: `NNNN-<short-kebab-name>.md` — concise enough to recognise on a directory listing.
- **One ADR per file**: never edit an accepted ADR's substance. Supersede instead (see Status lifecycle).

## Status lifecycle

```
Proposed → Accepted → Superseded by NNNN
                    ↘ Deprecated
```

| Status | Meaning |
|---|---|
| **Proposed** | Under review. Discussion ongoing. Safe to edit. |
| **Accepted** | Decision is in force. **Do not edit substance** — only the Status line may change. |
| **Superseded by NNNN** | A later ADR (numbered `NNNN`) replaces this one. Keep the file for historical context. |
| **Deprecated** | The decision no longer applies but has no direct successor. |

## Append-only rule (Constitution Principle VIII)

Once an ADR is **Accepted**, its body is immutable. To revisit a decision, write a new ADR that supersedes the old one and update both files' Status lines. This preserves the historical record of why decisions were made — and unmade — over time.

## Template

```markdown
# ADR NNNN: <title>

## Context
<the forces at play; what problem are we solving; what constraints apply>

## Decision
<the choice we made, stated as a positive assertion>

## Status
Accepted

## Consequences
<positive and negative consequences; what becomes easier; what becomes harder>

## Date
YYYY-MM-DD
```

## Index

| # | Title | Status | Date |
|---|---|---|---|
| 0001 | [Record architecture decisions](./0001-record-architecture-decisions.md) | Accepted | 2026-05-17 |
| 0002 | [Dynamic auth-provider loading](./0002-dynamic-auth-provider-loading.md) | Accepted | 2026-05-17 |
| 0003 | [Reuse Auth.js `Account` table for IdP links](./0003-reuse-authjs-account-table.md) | Accepted | 2026-05-17 |
| 0004 | [Encrypt OAuth tokens at rest](./0004-encrypt-oauth-tokens-at-rest.md) | Accepted | 2026-05-17 |
