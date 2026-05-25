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

4. **Review and update documentation:**

   Analyze `git diff main...HEAD` and use the mapping table below to determine which docs may need updating:

   | If the diff touches... | Review this doc |
   |---|---|
   | `src/` app code (routes, hooks, components, contexts, utils) | `AGENTS.md` |
   | `supabase/` (edge functions, config, migrations, types) | `docs/backend.md`, `AGENTS.md` |
   | `www/` (website code) | `docs/website.md`, `AGENTS.md` |
   | Pricing, subscription, paywall, RevenueCat | `docs/pricing.md` |
   | New features, feature removal, status changes | `docs/features.md`, `docs/positioning.md` AND relevant marketing content in `www/src/_data/features.json`, `www/src/tips/`, or `www/src/_data/faqs.json` |
   | User-facing behavior covered by existing website content | The matching `www/src/tips/<feature>.md` page or `www/src/_data/faqs.json` entry |
   | UI copy, tone, colors, typography, branding | `docs/brand.md` |
   | App Store metadata, screenshots, keywords | `docs/appstore.md` |
   | User-facing flows that change who/how | `docs/personas.md` |
   | `.claude/skills/` files | The affected skill's `SKILL.md` |
   | New patterns, anti-patterns, or conventions that PRs should enforce | `.cursor/BUGBOT.md` |

   For each affected doc: Read it, determine if the PR requires a concrete update, and apply changes with Edit. Skip docs not affected. Most PRs need 0–2 updates.

   Key rules:
   - `CLAUDE.md` and `AGENTS.md` must always stay identical — update both if either changes
   - Only update skills if the PR directly changes behavior the skill documents
   - Only make factual updates — no speculative or cosmetic edits
   - Err on the side of not updating if unsure

5. **Commit documentation updates** if any docs were changed:

   ```bash
   git add docs/ CLAUDE.md AGENTS.md .claude/skills/ .cursor/BUGBOT.md
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
- Documentation updates should be factual and minimal
- `CLAUDE.md` and `AGENTS.md` must always have identical content — update both if either changes
- Do not update docs for purely cosmetic code changes
- If unsure whether a doc needs updating, err on the side of not updating
