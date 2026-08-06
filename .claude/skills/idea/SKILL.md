---
name: idea
description: Prototype an idea into a testable MVP, iterate on it live, then formalize it into a Linear issue and PR once approved. Use when the user has a problem, solution, or rough sketch they want to build and try quickly.
argument-hint: [the idea — a problem, a solution, or a rough sketch]
disable-model-invocation: true
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, Agent, Skill, AskUserQuestion, mcp__linear-server__save_issue, mcp__linear-server__list_issue_labels, mcp__linear-server__list_issue_statuses, mcp__claude_ai_Linear__save_issue, mcp__claude_ai_Linear__list_issue_labels, mcp__claude_ai_Linear__list_issue_statuses
---

# Idea

Build an idea into something the user can look at and react to, fast. Iterate on it live. Only once the idea is **approved** does it get the formal treatment — blindspot review, tests, a Linear issue, and a PR.

This is the lightweight sibling of `/implement-issue`. That skill starts from a refined Linear issue and front-loads the rigor. This one starts from a sketch and defers the rigor until the design has stopped moving.

The skill runs in two acts. **Do not blur them.** Act 1 has no tests, no doc updates, and no code review — those exist to protect decisions that have already been made, and in Act 1 nothing has been decided yet.

## Act 1 — Build & iterate

### Step 1: Understand the idea

Read `$ARGUMENTS`. It may be a problem ("scheduling a task for next week takes too many taps"), a solution ("add a swipe-to-defer gesture"), or something in between.

If it's a bare problem with no proposed solution, sketch one or two approaches in prose and pick one.

**Ask questions freely here** — ideating is a conversation, and the cheapest place to change the idea is before it's built. Use `AskUserQuestion` (never plain-text questions) for as many rounds as the idea warrants. Two limits: don't ask what the codebase can answer — go look — and don't ask about details that the user is going to react to on screen anyway in Step 7. Fonts, spacing, and exact copy are for the iteration loop, not for a questionnaire.

### Step 2: Quick orientation

Issue these reads **in one parallel batch**, not one at a time:

- The architecture doc for the area being touched — `docs/frontend.md` for `src/`, `docs/backend.md` for `supabase/`, `docs/website.md` for `www/`
- `docs/design.md` if the idea touches any style value (it usually does)
- A grep for the existing component, hook, or utility this idea should extend

Grep `src/utils/theme.ts` for the specific tokens you need rather than reading it whole. Prefer extending what exists over adding a parallel variant; verify the constraint that would justify a new variant is real in this app first.

This is a small, bounded batch — deliberately **not** the parallel Explore agent fan-out that `/implement-issue` runs. **Size gate:** if after that one batch you still can't name the files the change goes in, the idea is too big to prototype — say so and route it to `/create-issue` → `/implement-issue` rather than building half an MVP.

### Step 3: Pitch before coding

State the approach and the scale of the change — which files, roughly how much — then get a go-ahead via `AskUserQuestion`. A pitch, not a plan document:

```
Approach: add a `useSnoozeTask` hook next to `useTasks`, wire a swipe action
into the existing `TaskRow` via `ReanimatedSwipeable`. ~2 files, ~80 lines.
Stubbing the snooze-duration picker as a fixed +1 day for now.
```

### Step 4: Branch and bootstrap

```bash
git checkout -b idea-<short-slug> main
```

The branch is **never renamed**, even after the Linear issue exists. `/open-pr` writes a `Closes [DEX-XXX]` line into the PR body, and that is what links the issue.

Then bootstrap the environment **now**, so a slow install overlaps with the build instead of stalling the hand-off in Step 6. The two commands below run differently — don't combine them into one call.

**1. Point the app at production Supabase** — fast, run it in the foreground:

```bash
.claude/skills/use-preview-branch/scripts/swap-env.sh --prod
```

It's idempotent and self-detecting: it resolves the repo root itself, copies `src/.env.local` from the main checkout when it's missing (a fresh worktree has none), points it at production, and fails loudly if no active Supabase key pair survives. A brand-new `idea-` branch has no Supabase preview branch yet, so production is correct — if the idea later needs one, `/use-preview-branch` handles the switch. If the main checkout was pointed at a preview, this flips it back to prod; mention that rather than letting it be silent.

**2. Install dependencies** — run this as a **background task with a long timeout**, never in the foreground. In a fresh worktree it's several minutes plus a `postinstall: patch-package` pass, far past the default Bash timeout:

```bash
[ -f src/node_modules/.package-lock.json ] || (cd src && npm install)
```

Then go straight to Step 5 — the build doesn't wait on the install, only the dev server in Step 6 does.

### Step 5: Build the MVP

The smallest thing that can be looked at and reacted to. Rules:

1. **Stub aggressively.** Hardcode anything that isn't the core of the idea — copy, durations, sort orders, seed data. Keep a running list of what was stubbed.
2. **Use the real design tokens** from `src/utils/theme.ts` (see `docs/design.md`). The iteration ahead is mostly visual, so the MVP has to render in the app's actual type scale, spacing, and colors — a prototype in arbitrary values can't be judged.
3. **TypeScript, no `any`.**
4. **No tests. No doc updates. No `/review-as-staff`.** This is a prohibition, not an oversight. The natural pull is to add them; resist it until Act 2.

Lint and format run automatically via the `PostToolUse` hook, so don't invoke them by hand.

### Step 6: Start the dev server and hand off

Confirm the background install from Step 4 finished, then check whether the port is already taken:

```bash
curl -s -m 1 http://localhost:8081/status
```

- **No response** → start the server as a background task: `cd src && npm start`.
- **It answers** → that is very likely a *different* worktree's bundler, not this one. There are dozens of worktrees under `.claude/worktrees/` and they all default to 8081. Do **not** tell the user to go look at 8081 — they'd be reviewing the wrong app and would report that nothing changed. Either stop the other server or let Expo take the next free port, and tell the user which port actually serves this prototype.

Hand off with: which screen or route to open, what to look at, what was stubbed, and what's still visibly rough. Be specific — the user is about to go look at it.

### Step 7: Iterate

Loop on feedback. Expect a lot of it, and expect it to be about specifics: fonts, colors, spacing, layout, copy, animation timing. Keep each edit tight and hot-reload-friendly so the feedback cycle stays short.

Commit at meaningful checkpoints with `Idea: <what changed>` messages, so a bad direction can be rolled back cheaply. The repo squash-merges, so these messages are throwaway — commit freely.

If the idea turns out to be a dead end, say so plainly and offer to delete the branch. If it sprouts a *second* idea mid-iteration, note it and don't build it.

**The approval gate.** Act 2 is expensive — a grilling, a test suite, a code review, a Linear issue — so do not infer approval from mid-loop praise. "That spacing is better" and "yeah, nice" are feedback, not approval; they mean keep going. Act 2 starts only when you have **explicitly asked** whether the idea is done and gotten a yes:

> This is feeling settled. Ready to formalize it — grill it for blindspots, add tests, and open a PR? Or keep iterating?

Ask via `AskUserQuestion`. Until that yes, stay in this loop.

## Act 2 — Formalize (only once approved)

### Step 8: Collaborate on the plan

Use the `/grill-me` skill to find what the MVP's shortcuts broke:

```
/grill-me
```

Pass the MVP diff, the list of stubs from Step 5, and this checklist as context:

- Stubbed or hardcoded values still sitting in the code
- Empty, loading, and error states
- Offline behavior and failure paths
- Platform parity — iOS, Android, **and web**
- Theme parity — light and dark, and every Appearance theme
- Data — does it need a migration? RLS? does it work for a brand-new user with no data?
- Existing users and backward compatibility
- Paywall and entitlement gating
- Accessibility and dynamic type
- Performance with a lot of rows
- Analytics and Sentry coverage

Not every item applies to every idea. Skip the ones that don't, and say which you skipped.

### Step 9: Plug the holes, and now add tests

This is where the rigor from `/implement-issue` gets borrowed:

1. Fix everything Step 8 surfaced and replace the stubs. **But if the grilling invalidated the approach rather than poking holes in it** — it can't work on web, it needs a data model the prototype contradicts — say so and go back to Act 1. Don't bolt tests and a Linear issue onto an approach that just failed.
2. **Add tests** following `docs/testing.md`, in `__tests__/` directories adjacent to source.
3. Run `cd src && npm run typecheck` explicitly. The `Stop` hook runs the test suite, and a green suite is not a typecheck.
4. If the idea needs a database migration, read the `supabase-postgres-best-practices` skill **before** writing it.

Skip documentation updates here — `/open-pr` walks the doc mapping table in Step 11.

### Step 10: Hand off review and create the Linear issue

Do both in the same turn.

**Prompt the user to review.** Tell them to run:

```
/code-review high --fix
```

This surfaces correctness bugs plus reuse/simplification cleanups and applies the fixes to the working tree. Let the user run it — the point is that it happens in parallel with the issue creation below, not that you can't invoke it. (`/review-as-staff` is the heavier option: the same review followed by `/simplify`.)

**While they review, create the Linear issue.** Call `save_issue` with `team: "DEX"`, `state: "In Progress"`, and a label mapped from the work type (`Enhancement`, `Bug`, or `Chore`). Use `list_issue_labels` / `list_issue_statuses` if either name doesn't resolve.

The work is already done, so this issue is lighter than `/create-issue`'s — no `## Plan`, no `## Test Cases`:

```
## Why
< the problem or itch this scratches >

## What shipped
< 2–5 bullets describing the behavior as actually built >

## Notes
< decisions made while iterating, remaining stubs, follow-ups >
```

Return the issue URL, then **stop and wait.** Only go to Step 11 after the user comes back with review feedback and you've fixed what it found.

### Step 11: Open the PR

```
/open-pr DEX-XXX
```

It handles the push, the documentation mapping table, the PR body, and the `Closes` link that ties the branch back to Linear.

## Important

- **Act 1 is unpolished on purpose.** No tests, no docs, no review, and no Linear issue until the user explicitly approves the idea in Step 7.
- **Linear MCP prefixes vary by connector.** Tools surface as either `mcp__linear-server__*` or `mcp__claude_ai_Linear__*`. Use whichever the environment actually exposes; both are listed in `allowed-tools`.
