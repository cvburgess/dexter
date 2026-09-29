---
name: summarize-pr
description: Summarize the current branch's PR as terse squash-commit bullet points and copy to clipboard. Use when the user wants a commit summary for squash-merging.
allowed-tools: Bash(git *), Bash(gh *), Bash(printf *), Bash(pbcopy)
---

# Summarize PR for Squash Commit

Generate concise bullet points summarizing a pull request, suitable for a squash commit message, and copy them to the clipboard.

## Instructions

1. **Get the current branch name:**

   ```bash
   git branch --show-current
   ```

2. **Fetch PR details** using the branch name:

   ```bash
   gh pr view <branch> --json title,body,commits,files --repo cvburgess/dexter
   ```

3. **Analyze the PR** — look at the title, body, commit messages, and changed files to understand the full scope of the changeset.

4. **Generate bullet points** following these rules:
   - Each bullet starts with `- ` and a present-tense **verb** (Add, Fix, Refactor, Update, Remove, Split, Extract, etc.)
   - Each bullet is **10 words max**
   - Cover all meaningful changes — don't omit things to save space
   - Group related small changes into one bullet when possible
   - Order: features first, then refactors, then fixes, then tests/CI/docs

5. **Copy to clipboard** using `printf` piped to `pbcopy`. Do not use `echo`.

6. **Display the bullets** to the user so they can review what was copied.

## Important

- Read the full PR body and all commit messages — do not summarize from the title alone
- Do not include issue numbers, PR numbers, or links in the bullets
- Do not add a header or trailing text — just the bullet lines
- If no PR exists for the current branch, inform the user and stop
