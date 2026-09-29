---
name: implement
description: Implement a change end-to-end, from a Linear issue or a plain description. Use when the user wants to build a feature, fix a bug, or complete work described in a Linear issue or in their own words.
argument-hint: [Linear issue id (e.g. DEX-294), Linear issue URL, or a description of the work]
disable-model-invocation: false
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, Agent, Skill, AskUserQuestion, mcp__linear-server__get_issue, mcp__linear-server__list_comments, mcp__linear-server__save_issue, mcp__linear-server__list_issue_labels
---

# Implement

Act as a staff-level engineer to implement a change end-to-end: understand the problem, plan the approach, write the code, add tests, update docs, and open a PR. Every change ships against a Linear issue; when none exists yet, this skill files one from the planning findings before any code is written.

## Instructions

### Step 1: Determine the mode and understand the request

Parse `$ARGUMENTS`:

- **Issue mode**: it contains a Linear identifier (`DEX-294`) or issue URL. Call `get_issue` with that `id`, and `list_comments` if discussion context would help.
- **Description mode**: it's a plain-language description of the work. There is no issue yet; treat the description as the issue payload for the steps below. Determine the issue type (`Bug`, `Enhancement`, or `Chore`) and ask if it's ambiguous.
- If only a bare numeric id is given, ask for the identifier or URL; do not guess. If `$ARGUMENTS` is empty, ask what to implement.

### Step 2: Evaluate issue readiness

> In description mode, skip this step: a fresh description is never implementation-ready. Go to Step 3.

An issue is **implementation-ready** when **all** of these hold:

- Has a **Plan** section with concrete, actionable steps (not vague bullets like "update the UI")
- Plan steps reference specific files, components, hooks, or patterns in the codebase
- Has **Test Cases** or clear testing guidance
- No unanswered questions in the Linear comments that block implementation
- No labels indicating it needs more work (e.g. `needs-refinement`, `needs-triage`)

**If ready:** skip Steps 3–4. Present the issue's plan with the Step 4 approval template, then proceed to Step 6 once approved.

**If not ready:** continue with Steps 3–4.

### Step 3: Research the codebase

Launch two read-only research subagents **in parallel** (Claude Code: `subagent_type: "Explore"`):

- **Agent A (codebase analysis):** prompt with the full issue payload (and comments if loaded), or the user's description. Ask it to map each plan step to the files, components, hooks, types, tables, and edge functions involved, and to name the existing patterns the implementation should follow.
- **Agent B (test and doc landscape):** prompt with the issue title and description. Ask it to find existing tests for the areas being changed and the test patterns to follow (`docs/testing.md`), and the docs worth *reading* for context. It should report a doc *update* only if it can name the durable gotcha this work would produce; "no doc updates needed" is the expected answer. Also ask it to flag marketing copy the change would make stale: `www/src/tips/`, `www/src/_data/faqs.json`, `www/src/_data/features.json`, `www/src/_data/releases.ts`.

### Step 4: Collaborate on the plan

Synthesize both agents' findings into a concrete plan, then run the `grill-me` skill to collaborate with the user on it, passing the plan, research findings, and open questions as context.

Once shared understanding is reached, get approval with your structured-question tool (Claude Code: `AskUserQuestion`):

```
Here's my implementation plan for DEX-XXX (or "for <short title>" in description mode):

1. [Step]: [files to change]
2. [Step]: [files to change]
...

Tests: [what tests to add/update]
Docs: [what docs to update]
Trade-offs: [architectural decisions, if any]

Does this look right, or should I adjust anything?
```

### Step 5: Save the plan to Linear

> Only in description mode. In issue mode, skip to Step 6.

Before writing any code, file the approved plan as a Linear issue so the research and decisions outlive this session. Use the `create-issue` skill's description template (`## Why`, `## Goal`, `## Plan`, `## Test Cases`, `## Notes`), filled from the research and the `grill-me` outcome: Plan steps name the files to change, Notes capture the decisions and trade-offs resolved while collaborating.

Call `save_issue` with `title` (under 80 characters), `team: "DEX"`, `description`, the type label from Step 1 (`list_issue_labels` if unsure), and `state: "Ready"`. Share the returned `url` with the user, and use the new identifier everywhere the steps below say "Linear identifier".

### Step 6: Create a feature branch

Use Linear's suggested branch name (`gitBranchName`) from `get_issue`, or from the `save_issue` response in description mode, when present; otherwise fall back to `<identifier-lowercase>-<short-slug>` (e.g. `dex-294-fix-login`).

```bash
git checkout -b <gitBranchName> main
```

### Step 7: Implement the changes

Work through the plan step by step. Linting and formatting run via hooks after every edit; to verify manually, use the project scripts (e.g. `cd src && npm run lint` or `cd www && deno task build`), never `npx tsc`, `npx eslint`, or `npx expo lint`.

Commit logical units of work as you go, with messages referencing the Linear identifier (e.g. `DEX-294`).

### Step 8: Add or update tests

Add tests for new behavior and update tests whose behavior changed, following the patterns found in Step 3 (or the issue's test cases) and `docs/testing.md`. Run the relevant suite yourself (`cd src && npm test` / the deno test command in `AGENTS.md`); the Stop hook lints but does not run tests. Fix failures before proceeding, and never skip or disable a test.

### Step 9: Review documentation (usually this means changing nothing)

**Gate 1:** did this work produce a durable fact the code cannot say for itself (a gotcha, a counterfactual, a constraint invisible at the point of use)? A new feature, endpoint, bug fix, refactor, or test does not qualify. **If no, write nothing.** Most issues stop here.

**Gate 2:** route by the kind of fact, not the directory you touched.

| The fact is... | It goes in |
|---|---|
| A rule for building any screen | `docs/frontend.md` |
| A rule for any table, migration, or function | `docs/backend.md` |
| What one feature does and why — screens and tables together | `docs/features.md` |
| What one endpoint promises | `docs/api-routes.md` |
| What a style token means | `docs/design.md` |
| A test-harness gotcha | `docs/testing.md` |
| App Store metadata | `docs/appstore.md` |

Prefer tightening or deleting over adding. Separately, if the change alters user-facing behavior the marketing site claims, update the matching copy flagged in Step 3 (see `docs/website.md`).

### Step 10: Self-review the diff

Run the `quick-code-review` skill. Commit what it changed, and act on anything it flagged but skipped.

### Step 11: Readability pass

Run the `optimize-for-readability` skill and commit what it changed. Its test deletions are intended; if you disagree with one, restore that file rather than skipping the pass.

### Step 12: Open a Pull Request

Run the `open-pr` skill with the Linear identifier so the PR body links to Linear.

## Important

- **Staff-level judgment**: if the plan has gaps or problems, flag them rather than blindly implementing
- **Never force-push or amend**: always create new commits
- **If stuck, ask**: ask the user rather than guessing at requirements
