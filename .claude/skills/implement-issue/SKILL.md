---
name: implement-issue
description: Implement a GitHub issue end-to-end. Use when the user wants to build a feature, fix a bug, or complete work described in a GitHub issue.
argument-hint: [issue number or URL]
disable-model-invocation: true
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, Agent, Skill, AskUserQuestion
---

# Implement GitHub Issue

Act as a staff-level engineer to implement a GitHub issue end-to-end: understand the problem, plan the approach, write the code, add tests, update docs, and open a PR.

## Instructions

### Step 1: Fetch and understand the issue

Parse the issue number from `$ARGUMENTS`. Accept either a number (`80`), a hash reference (`#80`), or a full GitHub URL.

```bash
gh issue view <number> --json title,body,labels,comments,assignees
```

Read the issue title, body, plan, and any comments carefully.

### Step 2: Evaluate issue readiness

Determine whether the issue is **implementation-ready** — meaning it has already been thoroughly refined and can be used directly as the implementation plan. An issue is implementation-ready when **all** of the following are true:

- Has a **Plan** section with concrete, actionable steps (not vague bullets like "update the UI")
- Plan steps reference specific files, components, hooks, or patterns in the codebase
- Has **Test Cases** or clear testing guidance
- No unanswered questions in the comments (no open threads asking for clarification that lack a response)
- No labels indicating it needs more work (e.g., `needs-refinement`, `needs-triage`)

**If the issue IS implementation-ready:** skip Steps 3–4 entirely. Use the issue's plan as-is. Present it to the user and ask for approval before proceeding, using AskUserQuestion:

```
Issue #<number> is well-refined — I'll use it directly as the implementation plan:

1. [Plan step from issue]
2. [Plan step from issue]
...

Test cases: [from issue]

Ready to start, or should I adjust anything?
```

Once approved, proceed to Step 5 (create branch).

**If the issue is NOT implementation-ready:** continue with Steps 3–4 below to research and collaborate on a plan.

### Step 3: Research the codebase

> Skip this step if the issue was evaluated as implementation-ready in Step 2.

Launch two sonnet subagents **in parallel** to build context:

#### Agent A — Issue & Codebase Analysis

Prompt with the full issue JSON. Ask it to:
- Read `docs/backend.md` if the issue affects `supabase/` (DB schema, RLS, edge functions, storage) — use it as primary context for backend patterns
- Read `docs/frontend.md` if the issue affects `src/` (routing, hooks, patterns, paywall, navigation) — use it as primary context for app patterns
- Read `docs/website.md` if the issue affects `www/` (landing pages, marketing copy, SEO, Lume templates, or website deploy behavior) — use it as primary context for website patterns
- Map each plan step to specific files, components, hooks, utilities, or edge functions in the codebase
- Identify existing patterns the implementation should follow (similar features, conventions, naming)
- Find relevant types, schemas, database tables, and edge functions
- Check `docs/` for product context (personas, features, pricing, brand)
- Return a structured mapping: plan step → relevant files and patterns

Set `subagent_type: "Explore"`.

#### Agent B — Test & Doc Landscape

Prompt with the issue title and body. Ask it to:
- Find existing tests related to the areas being changed (search `__tests__/` directories)
- Identify which test patterns to follow (unit, hook, route — see `docs/testing.md`)
- Identify which docs in `docs/` may need updating based on the issue (use the mapping from the open-pr skill: features.md, pricing.md, personas.md, brand.md, appstore.md, backend.md, frontend.md)
- Check if feature changes warrant updates to `docs/features.md`, `docs/positioning.md`, and the marketing website in `www/` (feature data lives in `www/src/_data/features.json`; tips pages live in `www/src/tips/`; read `docs/website.md` for website patterns)
- Check if the change affects user-visible behavior covered by an existing tip page in `www/src/tips/`, FAQ copy in `www/src/_data/faqs.json`, or release notes in `www/src/_data/releases.ts`.
- Return: relevant test files, test patterns to follow, and docs/website files that may need updates

Set `subagent_type: "Explore"`.

### Step 4: Collaborate on the plan

> Skip this step if the issue was evaluated as implementation-ready in Step 2.

Synthesize findings from both agents into a concrete implementation plan. The plan should:

- Follow the issue's plan steps as the primary guide
- Map each step to specific files to create or modify
- Include which tests to add or update
- Include which docs to update
- Note any architectural decisions or trade-offs

**Before writing any code, use the `/grill-me` skill to collaborate with the user on the plan.** Pass the synthesized plan, research findings, and any open questions as context. This will walk through each branch of the design, resolve ambiguities, and reach shared understanding.

```
/grill-me
```

Once shared understanding is reached, present the final plan to the user and wait for approval before proceeding. Use the AskUserQuestion tool with a summary like:

```
Here's my implementation plan for #<number>:

1. [Step] — [files to change]
2. [Step] — [files to change]
...

Tests: [what tests to add/update]
Docs: [what docs to update]

Does this look right, or should I adjust anything?
```

### Step 5: Create a feature branch

```bash
git checkout -b <branch-name> main
```

Use the branch naming convention: `<issue-number>-<short-description>`

### Step 6: Implement the changes

Work through the plan step by step. For each step:

1. **Read architecture docs first** — read `docs/backend.md` before modifying `supabase/`, `docs/frontend.md` before modifying `src/`, and `docs/website.md` before modifying `www/` to follow established patterns
2. **Read before writing** — always read files before modifying them
3. **Follow existing patterns** — match the codebase's style, naming, and conventions
4. **Keep changes focused** — only change what's needed for this issue
5. **Use TypeScript** — avoid `any` types

Linting and formatting run automatically via hooks after every file edit. If you need to manually verify, use the project's scripts (e.g., `cd src && npm run lint` or `cd www && deno task build`) — never use `npx tsc`, `npx eslint`, or `npx expo lint` directly.

Commit logical units of work as you go with clear commit messages referencing the issue number.

### Step 7: Add or update tests

Based on the test landscape from Step 3 (or the issue's test cases if Step 3 was skipped):

1. **Add new tests** for new functionality — follow the patterns in `docs/testing.md`
2. **Update existing tests** if behavior changed
3. **Place tests correctly** — in `__tests__/` directories adjacent to source, never inside `src/app/`
Tests run automatically via hooks when Claude stops responding. If tests fail, fix them before proceeding. Do not skip or disable tests.

### Step 8: Update documentation

Review which docs need updating based on what changed:

| If you changed... | Update these |
|---|---|
| App features, feature status | `docs/features.md`, `docs/positioning.md` AND `www/` website content when marketing claims change (feature data in `www/src/_data/features.json`, tips in `www/src/tips/` — see `docs/website.md` for patterns) |
| User-facing behavior covered by an existing tip page or FAQ | The matching `www/src/tips/<feature>.md` page or `www/src/_data/faqs.json` entry |
| Pricing, subscriptions, paywall | `docs/pricing.md` |
| User-facing flows | `docs/personas.md` |
| UI copy, colors, branding | `docs/brand.md` |
| App Store metadata | `docs/appstore.md` |
| Supabase functions, DB schema | `docs/backend.md` |
| App patterns, hooks, routing | `docs/frontend.md` |
| Testing patterns or setup | `docs/testing.md` |

Only make factual updates — no speculative or cosmetic edits. Skip docs that aren't affected. Most issues need 0–2 doc updates.

### Step 9: Self-review as a staff engineer

Before opening a PR, use the `/review-as-staff` skill to review your own changes. This catches issues before they reach a human reviewer.

```
/review-as-staff
```

If the review surfaces substantive issues, fix them and commit before proceeding. If the review is clean, move on.

### Step 10: Open a Pull Request

Use the `/open-pr` skill to create the pull request. Pass the issue number so it gets linked:

```
/open-pr #<issue-number>
```

## Important

- **Ask before coding** — always present the plan and get approval before writing code
- **Follow the issue's plan** — the issue body is the primary guide; don't freelance
- **Staff-level judgment** — if the issue's plan has gaps or problems, flag them rather than blindly implementing
- **Tests are required** — every implementation must include test coverage
- **Don't over-engineer** — implement what's asked, nothing more
- **Commit incrementally** — make small, logical commits as you work, not one giant commit
- **Never force-push or amend** — always create new commits
- **If stuck, ask** — use AskUserQuestion rather than guessing at requirements
