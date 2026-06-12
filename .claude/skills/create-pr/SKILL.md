---
name: create-pr
description: Create a pull request from the current branch targeting the develop branch. Use this skill whenever the user asks to create a PR, open a pull request, submit a PR, or push changes for review. Always use this skill for PR creation tasks, do not just run gh pr create manually.
---

# PR Creation Skill

Create a pull request from the current branch to `develop`, with an English title, a concise bullet-point description, and an appropriate label.

## Step-by-step workflow

### 1. Gather branch info

```bash
git branch --show-current
```

Then get the full commit history since `develop`:

```bash
git log develop..HEAD --oneline
git diff develop...HEAD --stat
```

### 2. Determine if this is a Spec Kit branch

A branch is a **Spec Kit branch** if a file exists at `specs/<branch-name>/spec.md` relative to the repo root.

```bash
# Example: current branch = 044-ghe-url-support
# Check: specs/044-ghe-url-support/spec.md
```

If the file exists → this is a Spec Kit branch. Read it and use the first heading (the `#` line) as the source of truth for what the feature is. Translate it concisely to English for the PR title.

If the file does not exist → derive the title from the git log / diff summary.

### 3. Craft the PR title

Keep it under 72 characters. Use sentence case (no period at end). The title should describe *what* the change does, not *how*.

**Spec Kit branch example:**
- spec.md heading: `# Feature spec: GitHub Enterprise URL support`
- PR title: `Add GitHub Enterprise base URL support`

**Non-Spec Kit branch example:**
- Commits: `fix: null pointer in auth middleware`, `fix: token expiry not handled`
- PR title: `Fix auth middleware null pointer and token expiry handling`

### 4. Write the PR description

Write a short bullet-point list in English summarising *what changed and why*. Aim for 3–6 bullets. Each bullet should be one complete sentence.

Focus on:
- New features or capabilities added
- Bugs fixed (and what the bug was)
- Notable implementation choices (e.g., added pagination, validation)
- Test coverage added

Example format:
```
## Summary
- Add `baseUrl` field to GitHub provider configuration to support GitHub Enterprise.
- Validate the URL format on save; show an inline error for invalid values.
- Disable the URL input unless the GHE checkbox is checked.
- Extend the GitHub API client to prefix all requests with the configured base URL.
- Add unit tests covering URL validation and API client URL construction.
```

### 5. Choose a label

Select **one or more** of the following that best describe the PR:

| Label | When to use |
|---|---|
| `enhancement` | New feature or improvement to existing functionality |
| `bug` | A fix for a defect or incorrect behaviour |
| `documentation` | Changes primarily to docs, comments, or specs |

It's fine to apply both `enhancement` and `bug` if the PR mixes features and fixes.

### 6. Create the PR

Use `gh pr create` targeting `develop`:

```bash
gh pr create \
  --base develop \
  --title "<title>" \
  --label "<label>" \
  --body "$(cat <<'EOF'
## Summary
- <bullet 1>
- <bullet 2>
- <bullet 3>
EOF
)"
```

If the label does not exist in the repository yet, omit `--label` and note it to the user.

### 7. Report back

After the PR is created, output the PR URL so the user can navigate to it directly.
