---
name: quick-code-review
description: Review the current branch diff at a depth matched to its size and blast radius — a fast hunk-only pass for small contained changes, a deeper full-context pass for larger or riskier ones — and apply the fixes. Use when the user wants their branch reviewed before opening or merging a PR.
argument-hint: [optional light or heavy to force a mode]
allowed-tools: Bash(git *), Bash(grep *), Bash(rg *), Read, Edit, Write, Glob, Grep
---

# Quick Code Review

Review the current branch as a careful engineer would, at a depth proportional to what the change can break, then fix what you find. Small contained diffs get a fast pass. Large or high-blast-radius diffs get the full treatment.

This skill is **self-contained**: it carries its own review prompts below and does not delegate to any other skill. Run the triage, then follow the prompt for the mode you picked, verbatim.

## Instructions

### Step 1: Establish the scope

Scope is always the current branch against `main`, including uncommitted work — reviews often run before the commit.

Run these **in one parallel batch**:

```bash
git diff main...HEAD --stat
git diff main...HEAD --name-only
git diff HEAD --stat
git diff HEAD --name-only
```

**Triage on the union of both.** Every check below — the blast-radius paths in Step 3, the fan-in count, and the size thresholds in Step 4 — runs against the combined file list and the combined line counts, not the committed diff alone. An uncommitted edit to a migration or a lockfile has exactly the same blast radius as a committed one, and reviews often run before the commit.

If there is no diff against `main` and no uncommitted changes, tell the user there is nothing to review and stop.

### Step 2: Check for a forced mode

If `$ARGUMENTS` contains `light` or `heavy`, use that mode, say so in one line, and skip to Step 5.

### Step 3: Check blast-radius overrides

**Any single hit here means heavy mode, regardless of how small the diff is.** These are the paths where a two-line change can break production or every screen at once:

- `supabase/migrations/**` — migration ordering is a documented hazard (`docs/backend.md`); a wrong dependency between migrations breaks the production push
- `supabase/functions/**` — Deno runtime, function secrets, and `deno test` does not type-check entrypoints
- Anything in the diff matching `POLICY`, `GRANT`, `SECURITY DEFINER`, `auth.uid`, or `service_role` — RLS and auth changes fail silently and leak rows
- `src/api/**`, `src/providers/**` — app-wide data flow; a break here reaches every screen
- `src/utils/theme.ts` — the design token system (`docs/design.md`); token changes ripple into every component
- `package.json`, `package-lock.json`, `patches/**` — a lockfile change floats transitive ranges and can turn lint/typecheck red in untouched files (DEX-116)
- `app.json`, `app.config.*`, `eas.json`, `.eas/workflows/**`, `.github/workflows/**` — build, release, and CI config
- Any auth, session, or token handling regardless of path

Then check **fan-in**. For each changed non-test file under `src/` (skip this if more than 10 files changed — you are already in heavy mode), count its importers:

```bash
grep -rl "from ['\"].*<basename-without-extension>['\"]" src --include=*.ts --include=*.tsx
```

Count the files it lists. **8 or more importers** on any changed module means heavy. A widely-imported module has a large blast radius by definition, however few lines changed.

### Step 4: Apply the size thresholds

If no override fired, choose **light** only when **all** of these hold:

- **5 or fewer non-test files** changed
- **150 or fewer changed lines** (insertions + deletions), excluding lockfiles and generated files
- The change is confined to **one top-level area** — `src/`, `supabase/`, `www/`, `docs/`, `scripts/`, or `.claude/`
- **Test files account for less than half the changed lines** — the light prompt below skips test hunks entirely, so a test-heavy diff would come back clean having reviewed almost nothing

Otherwise choose **heavy**. When the call is genuinely borderline, choose heavy: the cost of over-reviewing is some tokens, the cost of under-reviewing is a bug reaching `main`.

### Step 5: Announce the mode

Before reviewing, state in one line which mode you chose and **the specific signal that decided it**, so a wrong call is obvious immediately:

- `Light review — 3 files, 47 lines, all in src/components, no shared modules touched.`
- `Heavy review — supabase/migrations/ is in the diff.`
- `Heavy review — src/hooks/useTasks.ts has 14 importers.`
- `Heavy review — 12 files across src/ and supabase/, 480 lines.`

### Step 6: Read for context

Read the architecture doc for the areas the diff touches:

- `src/` → [`docs/frontend.md`](docs/frontend.md)
- `supabase/` → [`docs/backend.md`](docs/backend.md)
- a specific feature's screens or tables → [`docs/features.md`](docs/features.md)
- an edge function, the search RPC, the cron job, OAuth → [`docs/api-routes.md`](docs/api-routes.md)
- tests → [`docs/testing.md`](docs/testing.md)
- style values → [`docs/design.md`](docs/design.md)

In light mode read only the doc for the single area involved. Skip entirely if the diff is confined to `docs/` or `.claude/`.

### Step 7: Run the review

Follow the prompt for your chosen mode — [Light mode](#light-mode-prompt) or [Heavy mode](#heavy-mode-prompt) — exactly as written.

### Step 8: Apply the fixes

After producing the findings list, apply the findings to the working tree instead of stopping at the report: fix each one directly — correctness bugs and reuse/simplification/efficiency cleanups alike. Skip any finding whose fix would change intended behavior, require changes well outside the reviewed diff, or that you judge to be a false positive — note the skip rather than arguing with it.

Do not run `npm test`, `npm run lint`, or `npm run typecheck` unless a fix you applied plausibly affects them; if you do run them, report the actual result.

### Step 9: Report

Summarize in a few lines: the mode that ran, what it found, what was fixed, what was deliberately skipped and why, and anything worth a human's attention that you did not fix. A clean review is a valid outcome — say so plainly rather than manufacturing findings.

If light mode ran, end with one line offering the escalation: `Run /quick-code-review heavy for a deeper pass.` This makes a mistaken triage cost one message instead of a missed bug. Do not offer this after a heavy review.

---

## Light mode prompt

Follow this exactly.

> **Turn 1 — read**
>
> One tool call: read the unified diff (`git diff main...HEAD; git diff HEAD` to cover both committed and uncommitted changes). Skip test/fixture hunks (`test/`, `spec/`, `__tests__/`, `*_test.*`, `*.test.*`, `fixtures/`, `testdata/`) — test-file changes are not reviewed at this level. No subagents, no full-file reads.
>
> **Turn 2 — findings**
>
> Flag runtime-correctness bugs visible from the hunk alone: inverted/wrong condition, off-by-one, null/undefined deref where adjacent lines show the value can be absent, removed guard, falsy-zero check, missing `await`, wrong-variable copy-paste, error swallowed in a catch that should propagate. Also flag — still from the hunk alone — new code that duplicates an existing helper visible in the diff context, and dead code the diff leaves behind.
>
> Do **not** flag style, naming, perf, missing tests, or anything outside the hunk.
>
> Output at most **4 findings**, most-severe first, one line each: `path/to/file.ext:123 — what's wrong and the concrete failure`. If nothing qualifies, output exactly `(none)`.

## Heavy mode prompt

Follow this exactly.

> You are reviewing a pull request for real bugs. The diff under review is the current branch against `main` plus any uncommitted work (`git diff main...HEAD`; `git diff HEAD`). Treat this diff as the review scope.
>
> Review the diff as a careful senior engineer would: read every hunk, open the surrounding files for context as needed (Read, Grep, git log/blame/show), and hunt for correctness issues — wrong or inverted conditions, off-by-one, null/undefined dereference, missing `await`, dropped error handling, removed guards or validations, broken callers of changed functions, races. Prefer real failure modes over style; every finding needs a concrete scenario in which the code misbehaves.
>
> Bugs in unchanged lines of a touched function are in scope — the change re-exposes or fails to fix them.
>
> Alongside correctness, flag in the changed code only:
> - **Reuse** — new code that re-implements something the codebase already has. Grep shared/utility modules and files adjacent to the change, and name the existing helper to call instead.
> - **Simplification** — redundant or derivable state, copy-paste with slight variation, deep nesting, dead code left behind. Name the simpler form that does the same job.
> - **Efficiency** — redundant computation or repeated I/O, independent operations run sequentially, blocking work added to startup or hot paths. Name the cheaper alternative.
> - **Conventions** — clear violations of a governing `CLAUDE.md` (repo root, or one in a directory that is an ancestor of a changed file). Only flag a violation when you can quote the exact rule and the exact line that breaks it — no style preferences, no "spirit of the doc" inferences. Name the `CLAUDE.md` path and quote the rule.
>
> For cleanup and conventions findings, state the concrete cost — what is duplicated, wasted, harder to maintain, or which rule is broken — instead of a crash. Correctness bugs always outrank cleanup and conventions findings when the output cap forces a cut.
>
> Submit at most **15 findings**, most-severe first, one line each: `path/to/file.ext:123 — what's wrong and the concrete scenario in which the code misbehaves`. Quality over quantity: include everything you genuinely believe is a real issue, and nothing you don't. If nothing qualifies, output exactly `(none)`.

---

## Important

- **This skill applies fixes.** Review the result with `git diff` before committing.
- **Scope is always the branch diff against `main`, plus uncommitted work.** File-path and PR-number arguments are not supported; the only arguments are `light` and `heavy`.
- **Blast radius outranks size.** A one-line RLS policy change is a heavy review. Size thresholds only decide the cases where nothing dangerous was touched.
- **Never skip the mode announcement.** A silent triage decision is one the user cannot correct.
- **The prompts above are inlined deliberately.** The built-in `/code-review` sets `disableModelInvocation`, so no skill can call it — and its prompt varies by model family behind the scenes. Carrying the text here makes this review identical no matter which model runs it.
