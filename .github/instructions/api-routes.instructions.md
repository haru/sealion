---
applyTo: "src/app/api/**"
---

# API Route Instructions

## Response Envelope

All API routes **must** return responses using `ok(data)` / `fail(error, status)` from `src/lib/api-response.ts`:

```typescript
import { ok, fail } from "@/lib/api-response";

// Success: { data: T, error: null }
return ok(result);

// Error: { data: null, error: "message" }
return fail("Not found", 404);
```

## Authorization

- Always verify the session user owns the requested resource
- Never trust client-side checks alone — enforce at API layer with `session.user.id`
- Admin routes: verify `role === "ADMIN"` inside the handler (middleware alone is not sufficient)

## Input Validation

- Validate all request bodies with Zod schemas
- Fail fast with `fail("message", 400)` on validation errors

## Test Coverage

API route changes require integration tests in `tests/integration/api/`. See [AGENTS.md](../../../AGENTS.md) for integration test patterns.
