---
name: commit
description: Create a git commit for the current changes, with an English commit message and the change list written as bullet points. Use this skill whenever the user asks to commit, make a commit, save changes to git, or says things like "コミットして" / "コミットしといて" / "commit this" — even if they don't specify a message. Always use this skill for commit creation instead of running `git commit` ad hoc, so the message format stays consistent.
---

# Commit Skill

Create a git commit whose subject line follows this repository's `<type>: <description>` convention and whose body lists the changes as English bullet points (what changed, not why — keep the reasoning out of the body unless the user asks for it).

## Step-by-step workflow

### 1. Inspect the current state

Run these in parallel:

```bash
git status
git diff HEAD          # unstaged + staged changes combined view is fine here
git diff --staged
git log -5 --oneline   # match this repo's recent message style
```

If there are no changes at all (staged or unstaged), tell the user there is nothing to commit and stop.

### 2. Decide what to stage

- If changes are already staged (`git diff --staged` is non-empty) and the user didn't ask to include more, commit only what's staged.
- Otherwise, stage the files relevant to the request with `git add <path> <path> ...` — name files explicitly. Do not run `git add -A` or `git add .`, since that can sweep in unrelated or sensitive files (`.env`, credentials, stray build output).
- Before staging, scan `git status` for anything that looks out of place (files the user didn't mention, credential-shaped filenames). If something looks wrong, ask before adding it.

### 3. Pick the commit type

Use this repository's convention (see `.claude/rules/common/git-workflow.md`):

| type | when |
|---|---|
| `feat` | new feature or capability |
| `fix` | bug fix |
| `refactor` | code change that isn't a fix or a feature |
| `docs` | documentation only |
| `test` | adding or fixing tests |
| `chore` | tooling, deps, config, cleanup |
| `perf` | performance improvement |
| `ci` | CI/CD pipeline changes |

If the diff mixes types, pick the one that describes the dominant change.

### 4. Write the message

Subject line: `<type>: <short imperative description>`, under ~72 characters, no trailing period.

Body: a plain bullet list in English, one line per distinct change, each starting with a capitalized verb. Skip a body entirely if the change is a single trivial edit that the subject line already fully describes.

**Example:**
```
fix: correct GHE base URL validation

- Validate baseUrl format before saving provider config
- Disable the URL input unless the GHE checkbox is checked
- Add regression test for invalid URL input
```

Do not add a `Co-Authored-By` trailer or any other attribution line — this repo disables that globally (see `.claude/rules/common/git-workflow.md`).

### 5. Create the commit

Use a HEREDOC so multi-line messages are formatted correctly:

```bash
git commit -m "$(cat <<'EOF'
<type>: <description>

- <bullet 1>
- <bullet 2>
EOF
)"
```

Then run `git status` to confirm the commit succeeded and the working tree is in the expected state.

### 6. If a pre-commit hook fails

Fix the underlying issue, re-stage the affected files, and create a **new** commit. Never amend to work around a failed hook, and never use `--no-verify` unless the user explicitly asks for it.

## Notes

- Never push after committing unless the user separately asks for it.
- If the user gives you an explicit commit message, use it verbatim for the subject line but still confirm the body follows the bullet-point format above — reformat it if needed.
- This skill only commits; for opening a pull request afterward, use the `create-pr` skill instead.
