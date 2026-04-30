---
name: review-bugbot
description: Review and fix BugBot feedback on a pull request. Use when BugBot (cursor[bot]) has left review comments on a PR and you want to address them.
argument-hint: [optional PR number, e.g. 149]
allowed-tools: Bash(git *), Bash(gh *), Read, Grep, Glob, Edit, Write, Agent, AskUserQuestion
network-access: required
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

BugBot comments are review comments attached to specific reviews. On the **pull request reviews** REST API, the reviewer is `cursor[bot]`. On **GraphQL** review threads, inline comment authors are typically `cursor`. Match both where needed.

**Step 2a:** Find the latest BugBot review:

```bash
gh api repos/cvburgess/dexter/pulls/{number}/reviews \
  --jq '[.[] | select(.user.login == "cursor[bot]" or .user.login == "cursor")] | last | .id'
```

**Step 2b:** Fetch comments from that review:

```bash
gh api repos/cvburgess/dexter/pulls/{number}/reviews/{review_id}/comments \
  --jq '[.[] | {id: .id, path: .path, line: .line, body: .body}]'
```

**Step 2c:** Get the thread IDs for each comment (needed for resolving):

```bash
gh api graphql \
  -F owner='cvburgess' -F repo='dexter' -F number={number} \
  -f query='
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          reviewThreads(first: 100) {
            nodes {
              isResolved
              id
              comments(first: 5) {
                nodes {
                  databaseId
                  author { login }
                }
              }
            }
          }
        }
      }
    }
  ' --jq '
    [.data.repository.pullRequest.reviewThreads.nodes[]
     | {threadId: .id, resolved: .isResolved, comments: [.comments.nodes[] | {id: .databaseId, author: .author.login}]}
     | select(.comments | any(.author == "cursor" or .author == "cursor[bot]"))]
  '
```

Match thread IDs to comment IDs from step 2b. Note: threads may show as `resolved: true` in GraphQL after new commits push, but still need to be addressed if they appear in the latest review.

If there are no BugBot comments, inform the user and stop.

### Step 3: Parse each comment

For each BugBot comment (inside each thread's `comments` array), extract:

- **Thread ID** from the parent object's `threadId` field (needed to resolve dismissed threads)
- **Severity** (High / Medium / Low) from the markdown heading
- **Description** from between `<!-- DESCRIPTION START -->` and `<!-- DESCRIPTION END -->`
- **File path and lines** from the `diffHunk` and `path` fields
- **Bug ID** from `<!-- BUGBOT_BUG_ID: ... -->`
- **Comment ID** from the `databaseId` field (needed for replies)

### Step 4: Evaluate and fix

For each comment, read the flagged file and surrounding context. Determine if the issue is **valid** or **noise**.

**Valid** — The comment identifies a real problem. Fix it:
1. Read the file
2. Apply the fix with Edit
3. Track the comment_id and threadId for later resolution
4. Move to the next comment

**Noise** — The comment is a false positive (e.g., flagging an intentional change, misunderstanding context). Flag it to the user with a brief explanation of why it's a false positive. Draft a reply comment and offer to post it and resolve the thread. If the user approves, reply using **`in_reply_to`** (the `/comments/{id}/replies` sub-route often returns **404**):

```bash
gh api repos/cvburgess/dexter/pulls/{number}/comments \
  -f body="<reply>" -F in_reply_to={comment_id}
gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "{threadId}"}) { thread { isResolved } } }'
```

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
git add -A
git commit -m "Address BugBot feedback"
git push
COMMIT_SHA=$(git rev-parse HEAD)
```

### Step 7: Resolve fixed issues

For each valid issue that was fixed, reply to the BugBot comment with a link to the fixing commit and resolve the thread. Use **`POST .../pulls/{number}/comments`** with **`in_reply_to`** (same as Step 4 noise path); do not rely on `/comments/{comment_id}/replies` alone.

```bash
gh api repos/cvburgess/dexter/pulls/{number}/comments \
  -f body="Fixed in https://github.com/cvburgess/dexter/commit/{COMMIT_SHA}" \
  -F in_reply_to={comment_id}
gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "{threadId}"}) { thread { isResolved } } }'
```

`{comment_id}` is the numeric REST review comment id from Step 2b; it matches GraphQL `databaseId` on the same comment.

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
