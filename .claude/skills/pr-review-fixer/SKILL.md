---
name: "pr-review-fixer"
description: "Fetch the latest GitHub PR review comments and apply code fixes following TDD principles."
argument-hint: "Optional PR number (defaults to the latest open PR)"
---

## User Input

```text
$ARGUMENTS
```

If a PR number is provided, use it directly. Otherwise, fetch the latest open PR.

## Step 1: Fetch PR Review Information

Use GitHub MCP server tools as the primary method. Fall back to `gh` CLI only if MCP tools are unavailable.

**Primary (GitHub MCP server):**
1. Use `mcp__github__list_pull_requests` with `state: "open"` to identify the latest open PR
2. Use `mcp__github__pull_request_read` with the PR number to get details and review comments
3. Use `mcp__github__list_commits` to understand the full context of changes

**Fallback (gh CLI — only when MCP is unavailable):**
1. Run `gh pr list --state open --limit 5` to identify the latest open PR
2. Run `gh pr view <PR_NUMBER> --comments` to see all review comments
3. Run `gh pr diff <PR_NUMBER>` to understand the full context of changes
4. Run `gh pr checks <PR_NUMBER>` to see CI status

## Step 2: Analyze Review Comments

For each review comment:
- Categorize by severity: CRITICAL (security/correctness), HIGH (bugs/violations), MEDIUM (style/patterns), LOW (suggestions)
- Identify the file, line, and specific issue
- Understand the root cause, not just the symptom
- Note any related issues that may need fixing together

## Step 3: Plan Fixes

Before writing any code:
- Prioritize CRITICAL and HIGH issues first
- Identify if fixes require new or updated tests (TDD is MANDATORY)
- Check if fixes affect multiple files
- Verify understanding of required changes

## Step 4: Apply Fixes (TDD — MANDATORY)

For each fix:
1. **Write/update the test first** — confirm RED
2. **Implement the minimal fix** — confirm GREEN
3. **Refactor if needed** — keep tests green
4. Run `npm test` after every change — all tests must pass
5. Run `npm run lint` after every code change

## Step 5: Verify

- Run `npm test` — all tests must pass, coverage ≥ 95% lines
- Run `npm run lint` — no ESLint errors
- Run `npm run build` — TypeScript compilation must succeed
- Review your changes against each original comment to confirm resolution

## Project Standards to Enforce

### Language
- All source code, comments, commit messages, and documentation MUST be in **English** — never Japanese in .ts/.prisma/etc. files

### TDD
- NEVER modify implementation files without a failing test first
- Tests go in `tests/unit/` or `tests/integration/` (Jest) or `tests/e2e/` (Playwright)
- Pages, layouts, and components are tested via E2E, not Jest

### TSDoc
- Every exported function, class, interface, type alias, and constant MUST have a TSDoc block comment
- Include `@param`, `@returns`, `@throws` as applicable

### Immutability
- ALWAYS create new objects, NEVER mutate existing ones
- Use spread operators, `Object.assign`, or immutable update patterns

### Security
- Authorization enforced on both UI and API
- Credentials stored encrypted — never plaintext tokens
- Validate all user input at system boundaries

### i18n
- All UI strings live in `src/messages/en.json` and `src/messages/ja.json`
- Use `next-intl`'s `useTranslations` / `getTranslations` — never hardcode display strings

### API Responses
- Use `ok(data)` / `fail(msg, status)` helpers from `src/lib/api-response.ts`
- Consistent envelope: `{ data, error }`

## Code Quality Checklist (before marking done)

- [ ] All review comments addressed
- [ ] Tests written first (TDD), all passing
- [ ] Coverage ≥ 95% lines
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] No Japanese in source files
- [ ] TSDoc on all exported symbols
- [ ] Immutable patterns used
- [ ] No hardcoded secrets or display strings

## Output Format

After completing your work, provide a summary:
1. **PR Details**: PR number, title, author
2. **Review Comments Found**: List each comment with file, line, severity, and description
3. **Fixes Applied**: For each comment, describe what was changed and why
4. **Tests Written/Updated**: List test files modified
5. **Remaining Issues**: Any comments that could not be addressed and why
6. **Verification Results**: Output of `npm test`, `npm run lint`, `npm run build`

## Memory Updates

After completing the workflow, update agent memory at `/workspaces/sealion/.claude/agent-memory/pr-review-fixer/` with any newly discovered patterns worth remembering:

- Recurring issues (e.g., missing TSDoc, hardcoded strings, mutation patterns)
- Files or modules that frequently need attention
- Patterns the team prefers (e.g., specific error handling approaches)
- Test patterns and mock strategies used in the project
