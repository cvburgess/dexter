---
name: review-bugbot
description: Review and fix BugBot feedback on a pull request. Use when BugBot (cursor[bot]) has left review comments on a PR and you want to address them.
argument-hint: [optional PR number, e.g. 149]
allowed-tools: Bash(.claude/skills/review-bugbot/scripts/*), Bash(git *), Bash(gh *), Read, Grep, Glob, Edit, Write, Agent, AskUserQuestion
network-access: required
model: sonnet
effort: medium
---

# Review BugBot Feedback

Review BugBot (cursor[bot]) PR comments, determine which are valid, and fix them.

## Execution requirements

- **`gh` needs network access.** In sandboxed environments, run `gh` with network permission enabled (e.g. unrestricted network for GitHub API). Retrying with network access if the first attempt returns `Forbidden` or connection errors.
- **REST vs GraphQL usernames:** PR **reviews** list the app as `cursor[bot]`. **Review thread comments** often show the author as `cursor`. Use the filters below so both match.

## Instructions

### Step 1: Find the PR

- If `$ARGUMENTS` contains a PR number, use that.
- Otherwise, detect the current branch's PR:

```bash
gh pr view --json number -q .number
```

If no PR is found, inform the user and stop.

### Step 2: Fetch BugBot comments

Run the fetch script with the PR number:

```bash
.claude/skills/review-bugbot/scripts/fetch-bugbot-threads.sh {number}
```

It finds the latest BugBot review (handling the author-name discrepancy: `cursor[bot]` on the REST reviews API, `cursor` on GraphQL review threads), fetches that review's comments, matches each to its GraphQL review thread, and prints one JSON array of `{comment_id, thread_id, path, line, body, resolved}` objects.

Note: threads may show as `resolved: true` in GraphQL after new commits push, but still need to be addressed if they appear in the latest review.

If the script reports no BugBot review, inform the user and stop.

### Step 3: Parse each comment

For each entry in the script's output, extract from `body`:

- **Severity** (High / Medium / Low) from the markdown heading
- **Description** from between `<!-- DESCRIPTION START -->` and `<!-- DESCRIPTION END -->`
- **Bug ID** from `<!-- BUGBOT_BUG_ID: ... -->`
- **Exact lines** from the `LOCATIONS START/END` block (e.g. `path#L148-L167`) — the JSON `line` field is often null on BugBot comments

The `comment_id` (for replies) and `thread_id` (for resolving) come directly from the JSON.

### Step 4: Evaluate and fix

For each comment, read the flagged file and surrounding context. Determine if the issue is **valid** or **noise**.

**Valid** — The comment identifies a real problem. Fix it:
1. Read the file
2. Apply the fix with Edit
3. Track the comment_id and threadId for later resolution
4. Move to the next comment

**Noise** — The comment is a false positive (e.g., flagging an intentional change, misunderstanding context). Flag it to the user with a brief explanation of why it's a false positive. Draft a reply comment and offer to post it and resolve the thread. If the user approves:

```bash
.claude/skills/review-bugbot/scripts/reply-and-resolve.sh {number} {comment_id} {thread_id} "<reply>"
```

(The script posts the reply via `in_reply_to` — the `/comments/{id}/replies` sub-route often returns **404** — then resolves the thread via GraphQL.)

Process comments in order of severity: High first, then Medium, then Low.

### Step 5: Update the PR description

After fixing issues, check if the PR description needs updating:

- If BugBot flagged a discrepancy between the PR description and the actual code, update the description to match
- If a fix materially changed the code (e.g., removed a feature, changed an approach), update the summary to reflect what the PR actually does now

```bash
gh pr edit {number} --body "<updated body>"
```

Skip this step if fixes were cosmetic and the PR description is still accurate.

### Step 6: Commit and push

If any fixes were applied:

```bash
# stage only the files you fixed — avoid `git add -A`, which would sweep in
# unrelated local edits or untracked files
git add <files you edited>
git commit -m "Address BugBot feedback"
git push
COMMIT_SHA=$(git rev-parse HEAD)
```

### Step 7: Resolve fixed issues

For each valid issue that was fixed, reply to the BugBot comment with a link to the fixing commit and resolve the thread:

```bash
.claude/skills/review-bugbot/scripts/reply-and-resolve.sh {number} {comment_id} {thread_id} \
  "Fixed in https://github.com/cvburgess/dexter/commit/{COMMIT_SHA}"
```

`{comment_id}` and `{thread_id}` come from the Step 2 script output.

### Step 8: Report

Provide a brief summary of what was addressed and what was skipped:

```
BugBot review complete:
- Fixed: <count> issues
  - <one-line summary per fix>
- Skipped: <count> (false positives)
  - <one-line reason per skip>
```

## Important

- Read the actual code before deciding if a comment is valid — don't trust the comment blindly
- Check `.cursor/BUGBOT.md` for the project's own BugBot rules to understand intent
- Don't fix issues that would change intentional behavior
- Keep fixes minimal and focused — only address what BugBot flagged
- Never force-push or amend commits
