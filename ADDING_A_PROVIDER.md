# Adding a New Issue Provider

This guide describes every step required to add a new issue tracker as a provider in Sealion.
All provider-specific logic is confined to `src/services/issue-provider/<name>/`.
No changes to API routes, UI components, or auth code are required.

---

## Overview of the Architecture

Each provider is represented by two things:

| Piece | File | Purpose |
|-------|------|---------|
| **`ProviderMetadata`** | `<name>.metadata.ts` | Drives UI (icon, credential fields, base URL mode) without any server imports |
| **`IssueProviderAdapter`** | `<name>.ts` | Implements all API calls to the external service |

The registry (`registry.ts`) holds every metadata object. The factory (`factory.ts`) instantiates the right adapter at runtime. Neither file knows about your provider until you add the two entries shown below — everything else is data-driven.

---

## Step-by-Step Checklist

### 1. Install the SDK (if needed)

```bash
npm install <provider-sdk-package>
```

If no SDK exists, use `axios` directly (see the Jira/Redmine adapters for reference).

---

### 2. Register the provider metadata

**`src/services/issue-provider/<name>/<name>.metadata.ts`** — ProviderMetadata:

```typescript
{
  type: "YOURPROVIDER",           // provider type identifier string
  displayName: "Your Provider",   // proper noun, not translated
  iconUrl: "/providers/yourprovider.svg",  // or null if no icon
  baseUrlMode: "none",            // "required" | "optional" | "none"
  credentialFields: [
    {
      key: "token",               // must match a key in the Zod schema
      labelKey: "token",          // key under providers.fields in i18n files
      inputType: "password",      // "text" | "password"
      required: true,
    },
  ],
  credentialSchema: myProviderCredentialSchema,
}
```

---

### 3. Create `src/services/issue-provider/<name>/<name>.metadata.ts`

```typescript
import { z } from "zod";
import type { ProviderMetadata } from "@/services/issue-provider/metadata";

/** Zod schema for <Name> credentials. */
export const myProviderCredentialSchema = z.object({
  token: z.string().min(1),
  // add more fields as needed
});

/**
 * Metadata for the <Name> provider.
 * This file is client-safe — no server-only imports.
 */
export const myProviderMetadata: ProviderMetadata = {
  type: "YOURPROVIDER",           // must match the Prisma enum value exactly
  displayName: "Your Provider",   // proper noun, not translated
  iconUrl: "/providers/yourprovider.svg",  // or null if no icon
  baseUrlMode: "none",            // "required" | "optional" | "none"
  credentialFields: [
    {
      key: "token",               // must match a key in the Zod schema
      labelKey: "token",          // key under providers.fields in i18n files
      inputType: "password",      // "text" | "password"
      required: true,
    },
  ],
  credentialSchema: myProviderCredentialSchema,
};
```

**`baseUrlMode` values:**

| Value | Use when |
|-------|----------|
| `"none"` | SaaS-only service with a fixed API URL (e.g. GitHub, Linear) |
| `"optional"` | Self-hosted option exists but SaaS URL is the default (e.g. GitLab) |
| `"required"` | Users must supply the base URL (e.g. Jira, Redmine) |

**Place the icon** at `public/providers/yourprovider.svg`. Use `fill="#XXXXXX"` for consistent theming (see `public/providers/linear.svg` as reference).

---

### 4. Create `src/services/issue-provider/<name>/<name>.ts`

Implement all six methods of `IssueProviderAdapter` (`src/lib/types.ts`):

```typescript
import type { ExternalProject, IssueProviderAdapter, NormalizedIssue } from "@/lib/types";

export { myProviderMetadata } from "./<name>.metadata";

/** Adapter for the <Name> issue provider. */
export class MyProviderAdapter implements IssueProviderAdapter {
  constructor(private readonly token: string) {}

  /** @throws If credentials are invalid or the provider is unreachable. */
  async testConnection(): Promise<void> { /* verify credentials */ }

  /** @returns All projects/repos accessible with the current token. */
  async listProjects(): Promise<ExternalProject[]> { /* return [{ externalId, displayName }] */ }

  /**
   * @param projectExternalId - The externalId stored in Project.externalId.
   * @returns Open issues assigned to the authenticated user.
   */
  async fetchAssignedIssues(projectExternalId: string): Promise<NormalizedIssue[]> { /* ... */ }

  /** @returns Open issues with no assignee. */
  async fetchUnassignedIssues(projectExternalId: string): Promise<NormalizedIssue[]> { /* ... */ }

  /** Closes the issue on the external service. */
  async closeIssue(projectExternalId: string, issueExternalId: string): Promise<void> { /* ... */ }

  /** Posts a comment to the issue. */
  async addComment(projectExternalId: string, issueExternalId: string, comment: string): Promise<void> { /* ... */ }
}
```

**`NormalizedIssue` shape** (all adapters must produce this):

```typescript
{
  externalId: string;          // unique ID in the external system
  title: string;
  dueDate: Date | null;
  externalUrl: string;         // link to the issue in the provider UI
  isUnassigned: boolean;       // true = fetchUnassignedIssues; false = fetchAssignedIssues
  providerCreatedAt: Date | null;
  providerUpdatedAt: Date | null;
}
```

Every adapter **must** include a TSDoc block on every exported symbol.

---

### 5. Register in `src/services/issue-provider/registry.ts`

```typescript
import { myProviderMetadata } from "./<name>/<name>.metadata";

registerProvider(myProviderMetadata);   // add this line alongside the others
```

---

### 6. Wire up the factory in `src/services/issue-provider/factory.ts`

Add a credentials interface, extend the union, and add a `case` branch:

```typescript
/** Credentials for a <Name> provider. */
export interface MyProviderCredentials {
  token: string;
}

export type ProviderCredentials =
  | GitHubCredentials
  | JiraCredentials
  | RedmineCredentials
  | GitLabCredentials
  | LinearCredentials
  | MyProviderCredentials;  // ← add here

// Inside createAdapter():
case "YOURPROVIDER": {
  const creds = credentials as MyProviderCredentials;
  return new MyProviderAdapter(creds.token);
}
```

---

### 7. Add i18n labels

Add labels for each credential field key under `providers.fields` in both locale files.

**`src/messages/en.json`:**
```json
{
  "providers": {
    "fields": {
      "token": "Access Token"
    }
  }
}
```

**`src/messages/ja.json`:**
```json
{
  "providers": {
    "fields": {
      "token": "アクセストークン"
    }
  }
}
```

> Only add keys that do not already exist. Reuse existing keys (e.g. `"apiKey"`, `"token"`) when the semantic meaning is the same.

---

### 8. Write tests (TDD — write tests first)

**Unit tests** (`tests/unit/services/issue-provider/<name>.test.ts`):

- Mock the SDK/HTTP client entirely.
- Test each of the six adapter methods: success path, auth failure, pagination edge cases.
- Verify `NormalizedIssue` mapping (field names, date conversion, `isUnassigned` flag).

**Update existing tests:**

- `tests/unit/api/providers.test.ts` — add `"YOURPROVIDER"` to the expected provider type list.
- `tests/integration/api/providers.test.ts` — same.

---

### 9. Quality gates

Run these in order before considering the feature complete:

```bash
npm test                     # must be GREEN, ≥ 95% line coverage
npm run lint                 # zero ESLint errors
npm run build                # zero TypeScript errors
npx playwright test          # E2E: provider appears in the Add Provider dialog
```

---

## What You Must NOT Do

| Forbidden | Required instead |
|-----------|-----------------|
| `if (type === "YOURPROVIDER")` outside `src/services/issue-provider/` | Use `getProviderMetadata(type).someField` |
| Hardcoded provider type arrays in UI or API code | Use `getAllProviders()` |
| i18n keys keyed on the provider type string | Use `metadata.displayName` (proper noun, untranslated) |
| Storing credentials in plaintext | Use `encrypt()` / `decrypt()` from `src/lib/encryption.ts` — this is handled automatically by the existing sync and provider API routes |
| Running `prisma migrate dev` without checking for drift | Run `npx prisma migrate status` first (only needed when schema changes) |

---

## File Checklist

```
src/services/issue-provider/<name>/
├── <name>.metadata.ts        NEW — ProviderMetadata + credential Zod schema
└── <name>.ts                 NEW — Adapter class + re-export of metadata

public/providers/
└── <name>.svg                NEW — Provider icon

prisma/schema.prisma          NO CHANGE — provider type is a text column, no enum

src/services/issue-provider/
├── registry.ts               EDIT — registerProvider(myProviderMetadata)
└── factory.ts                EDIT — credentials interface + createAdapter case

src/messages/en.json          EDIT — providers.fields.<fieldKey>
src/messages/ja.json          EDIT — providers.fields.<fieldKey>

tests/unit/services/issue-provider/
└── <name>.test.ts            NEW — unit tests for the adapter

tests/unit/api/providers.test.ts        EDIT — add new type to assertions
tests/integration/api/providers.test.ts EDIT — add new type to assertions
```

---

## Reference Implementations

| Provider | SDK style | `baseUrlMode` | Credential fields |
|----------|-----------|---------------|-------------------|
| GitHub | `@octokit/rest` | `none` | `token` |
| GitLab | `axios` | `optional` | `token` |
| Linear | `@linear/sdk` | `none` | `apiKey` |
| Jira | `axios` | `required` | `email`, `apiToken` |
| Redmine | `axios` | `required` | `apiKey` |

Examine `src/services/issue-provider/gitlab/` (self-hosted optional base URL) or
`src/services/issue-provider/linear/` (SaaS-only) as the closest templates for a new provider.
