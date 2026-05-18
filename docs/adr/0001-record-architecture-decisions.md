# ADR 0001: Record architecture decisions

## Context

Sealion has grown beyond a handful of files. Decisions about authentication, persistence, multi-provider abstractions, and runtime configuration are now load-bearing for the whole codebase. We have no durable record of *why* those decisions were made — context lives in PR descriptions, Slack threads, and the heads of the original authors.

Constitution v1.4.0 introduces **Principle VIII (Architectural Decision Records)**, which requires us to capture significant design decisions in append-only, numbered documents under `docs/adr/`.

## Decision

Adopt the **lightweight ADR format** popularised by Michael Nygard and described in [`docs/adr/README.md`](./README.md):

- One file per decision, numbered `NNNN-<short-kebab-name>.md`.
- Sections: **Context**, **Decision**, **Status**, **Consequences**, **Date**.
- Once **Accepted**, the body is immutable; supersede with a new ADR rather than editing.
- Maintain an index table in `docs/adr/README.md`.

Every significant architectural choice from this point forward — and the major decisions already embedded in the OIDC feature (ADRs 0002–0003) — must be captured as an ADR.

## Status

Accepted

## Consequences

**Positive**:
- Future contributors can read the *why* behind any major shape in the codebase without reverse-engineering from code.
- Decisions can be revisited explicitly (via a superseding ADR) instead of silently drifting.
- Code reviews can cite an ADR to anchor a design choice.

**Negative**:
- A small per-decision authoring cost (≈ 10 minutes for a typical ADR).
- Risk of ADR rot if the index is not maintained — mitigated by the post-merge hook that updates `docs/adr/README.md` whenever an ADR is added.

**Neutral**:
- ADRs do **not** replace inline comments, the project README, or the constitution. They sit alongside them, focused on durable decisions.

## Date

2026-05-17
