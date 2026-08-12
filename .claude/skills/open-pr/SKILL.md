---
name: open-pr
description: Open a GitHub pull request for the current branch. Use when the user wants to create a PR, submit a pull request, or open a merge request.
argument-hint: [optional additional context for the PR]
allowed-tools: Bash(git *), Bash(gh *), Read, Grep, Glob, Edit, Write, mcp__linear-server__get_issue
---

# Open a Pull Request

Create a GitHub pull request for the current branch.

## Instructions

1. **Gather context** by running these commands in parallel:

   - `git status -u` to check for uncommitted changes
   - `git branch --show-current` to get the current branch name
   - `git log main..HEAD --oneline` to see all commits on this branch
   - `git diff main...HEAD --stat` to see which files changed
   - `git branch -vv` to check if the current branch tracks a remote (look for the current branch in the output)

2. **Commit any uncommitted changes** automatically. Stage all modified and untracked files relevant to the branch's work and commit with a descriptive message. Do not ask — just commit.

3. **Determine the linked Linear issue:**

   - Check `$ARGUMENTS` for a Linear identifier (`DEX-294`) or URL. If present, call `get_issue` and use the returned `title` and `url`.
   - Else, if the branch matches `^([a-z]+)-(\d+)-` (e.g., `dex-294-integrate-linear`), uppercase the prefix to build the identifier and call `get_issue` to confirm.
   - If no Linear issue is found, skip the `Closes` line in the PR body.

4. **Review documentation — usually this means changing nothing.**

   **Gate 1: did this PR produce a durable fact the code cannot say for itself?**
   A gotcha, a counterfactual (something tried that failed, and why), a constraint
   invisible at the point of use, or a decision that would otherwise be
   re-litigated. **If no, write nothing and go to step 5.** Most PRs stop here.

   These do **not** earn a doc update:
   - A new feature or screen that works as designed — shipping is not a reason to narrate
   - A new endpoint whose contract is already readable in its own file
   - A bug fix, a refactor, a rename, a new test
   - Anything the repo, the types, or `git log` already answers

   **Gate 2: route by the kind of fact, not the directory you touched.**

   | The fact is... | It goes in |
   |---|---|
   | A rule for building any screen | `docs/frontend.md` |
   | A rule for any table, migration, or function | `docs/backend.md` |
   | What one feature does and why — screens and tables together | `docs/features.md` |
   | What one endpoint promises | `docs/api-routes.md` |
   | What a style token means | `docs/design.md` |
   | App Store metadata, screenshots, keywords | `docs/appstore.md` |
   | A repo-wide constraint or command | `AGENTS.md` |
   | Behavior a skill documents | The affected skill's `SKILL.md` |

   Separately, if the PR changes **user-facing behavior the marketing site
   claims**, update the matching `www/src/tips/<feature>.md` page,
   `www/src/_data/faqs.json` entry, or `www/src/_data/features.json` — that is
   product copy going stale, not engineering docs growing.

   Key rules:
   - **Prefer tightening or deleting over adding.** If this PR made a paragraph obsolete, delete it — a doc edit that only removes text is a success
   - A feature narrative inside `frontend.md`/`backend.md` is the specific failure the docs split exists to prevent
   - `CLAUDE.md` and `AGENTS.md` must always stay identical — update both if either changes
   - Only update skills if the PR directly changes behavior the skill documents
   - Only make factual updates — no speculative or cosmetic edits
   - Err on the side of not updating if unsure

5. **Commit documentation updates** if any docs were changed:

   ```bash
   git add docs/ CLAUDE.md AGENTS.md .claude/skills/
   ```

   Only commit if there are staged changes. Use message: `Update documentation for PR`. Skip entirely if no docs changed.

6. **Push the branch** if it hasn't been pushed yet:

   ```bash
   git push -u origin <branch-name>
   ```

7. **Analyze all commits** on the branch (not just the latest) using `git diff main...HEAD` and draft the PR:

   - **Title**: Short (under 70 characters), describes the change starting with a verb like "Fix", "Refactor", "Add", etc. Prefix with the Linear issue key. `DEX-XXX: <short summary>`
   - **Body**: Use the template below.

8. **Create the PR** using the GitHub CLI with a HEREDOC for the body to avoid shell escaping issues:

   ```bash
   gh pr create --title "<title>" --body "$(cat <<'EOF'
   <filled template>
   EOF
   )"
   ```

9. **Return the PR URL** to the user after creation.

## PR Body Template

```
## Summary
- Bullet point describing the change
- Another bullet point if needed

Closes [DEX-XXX](linear-issue-url)

## Documentation updates
- List any docs/skills updated, or "No documentation changes needed"

## Test plan
- [ ] How to verify this works
```

If a Linear issue was found, replace `DEX-XXX` in the `Closes` line with the actual identifier and link the URL (e.g. `Closes [DEX-294](https://linear.app/cvburgess/issue/DEX-294)`). This triggers Linear's GitHub integration to move the issue to Done when the PR merges. If no Linear issue was found, omit the `Closes` line entirely.

## Important

- Always target `main` as the base branch
- Never force-push or amend commits as part of this skill
- If the branch has no commits ahead of main, inform the user and do not create a PR
- Keep the summary focused on **what changed and why**, not listing every file
- **Most PRs need no doc changes at all** — writing is the exception, not the routine
- `CLAUDE.md` and `AGENTS.md` must always have identical content — update both if either changes
- Do not update docs for purely cosmetic code changes
- If unsure whether a doc needs updating, err on the side of not updating
