---
name: optimize-for-readability
description: Remove low-value tests, re-author bloated docs sections, and compress oversized comment blocks so the codebase stays accurate, valuable, and human-readable. Use when the user wants to strip AI-generated bloat from a branch, a path, or the whole repo.
argument-hint: [optional path (e.g. src/components, docs/) or "all" for a whole-repo pass; default is the current branch diff]
disable-model-invocation: true
allowed-tools: Bash(git *), Bash(grep *), Bash(rg *), Bash(cd src && npm *), Bash(cd src && npx prettier *), Bash(cd supabase && deno *), Read, Edit, Write, Glob, Grep
---

# Optimize for Readability

AI tools accrete long docs sections, low-value tests, and comment essays faster than humans prune them. This skill is the pruning pass: it enforces rules the repo already has — the low-value-test list in `docs/testing.md`, the 2-line comment cap and docs philosophy in `CLAUDE.md` — against existing code, not just new changes.

This is **not** a code review. Do not hunt for bugs, do not change behavior, do not rename or restructure code — that is `/quick-code-review`'s job. Every edit here either deletes something or rewrites prose; runtime behavior is identical before and after.

## Instructions

### Step 1: Establish the scope

Three modes, decided by `$ARGUMENTS`:

- **No arguments — diff mode.** Scope is the current branch against `main` plus uncommitted work. Run `git diff main...HEAD --name-only` and `git diff HEAD --name-only` in one parallel batch and take the union. If both are empty, tell the user there is nothing to optimize and stop.
- **A path (e.g. `src/components`, `docs/`) — path mode.** Scope is `git ls-files <path>`.
- **`all` — whole-repo mode.** Work area by area, running Steps 3–7 to completion (including verification and the commit) for one area before starting the next: `src/utils`, `src/hooks`, `src/api`, `src/providers`, `src/components`, `src/app`, `src/__tests__`, `supabase/functions`, `supabase/__tests__`, `docs/`, `www/`, `scripts/`, then every remaining top-level directory `git ls-files` reveals — the list above orders the pass, it does not bound it. Per-area commits keep one bad area revertible without losing the rest.

Announce the mode and scope in one line before touching anything, e.g. `Diff mode — 6 files on dex-201-foo.` or `Whole-repo pass — starting with src/utils.`

### Step 2: Read the doctrine

Read the criteria from their source files — do not work from memory:

- `docs/testing.md` — "Which tests are worth writing": the keep-list (pure logic, security properties, API contracts, DEX-xxx regression pins) and the five "not worth writing" categories removed en masse in DEX-143.
- `CLAUDE.md` — the comment rule under "Standards" and the "Which docs are worth writing" section.

The definitions live there on purpose: this skill names the categories but never restates them, so the doctrine cannot drift between the two files.

### Step 3: Pass 1 — remove low-value tests

For each test file in scope, read it and delete every test that falls into one of `docs/testing.md`'s five "not worth writing" categories, plus table-completeness tests that re-enumerate a data structure and assert its entries exist. Cite the category for each deletion in the report.

- **Delete outright.** Never `.skip`, never `xit`, never comment out — a skipped test is bloat plus a false promise.
- If a file empties, delete the file with `git rm`, along with any mock, fixture, or `testUtils` helper that only it used. `git rm` stages the deletion — which is why review commands below use `git diff HEAD`, not bare `git diff`.
- **Never delete**: pure-logic tests, security-property tests, API-contract tests, or any test annotated with a `DEX-xxx` id — a cheap-looking test pinning a regression stays; that is what the annotation is for. When genuinely unsure whether a test is a regression pin, keep it: the cost of a stale test is tokens, the cost of an unpinned regression is a shipped bug.

### Step 4: Pass 2 — re-author docs sections

For each markdown file in scope, scrutinize every section longer than 5 lines. The 5-line mark is a **trigger, not a cap**: re-author the section to keep only what the code cannot say — gotchas, counterfactuals, team opinions, constraints invisible at the point of use — at whatever length that lands. Delete file listings, command tables, workflow enumerations, feature narratives, and changelog-style prose entirely; the repo and its git history already answer those. An edit that only removes text is a success, not a no-op.

**Never touch**: `CLAUDE.md` and `AGENTS.md` (curated agent config that must stay byte-identical — leave both alone entirely), `CHANGELOG.md` (user-facing release notes), and `.claude/**` (skills are procedures by design). `CLAUDE.md`'s "4 doc lines per PR" cap governs additions on feature PRs; it does not restrict this removal-dominant pass.

### Step 5: Pass 3 — compress comment blocks

For each source file in scope, find comment blocks over 2 lines: runs of 3+ consecutive `//` lines, and `/* */` or JSDoc blocks spanning more than 2 lines of content. Rewrite each to at most 2 lines keeping only the gotcha, constraint, or why-the-obvious-alternative-failed — or delete it entirely when it restates what the code says. Preserve `DEX-xxx` references when compressing; they are the durable pointer to the full story.

- **JSDoc carve-out:** on exported utilities and types, `@param`/`@returns` tag lines survive outside the 2-line count only when they carry information the signature does not (units, invariants, valid ranges). Tags that restate a parameter's name or type get deleted, and the prose portion still obeys the 2-line rule.
- **Never touch**: `eslint-disable` and other pragmas, `@ts-expect-error` annotations, and license headers.

### Step 6: Verify

- If any `src` test file changed: `cd src && npm test` **and** `cd src && npm run typecheck` — jest strips types, so a deletion that orphans a helper passes tests and fails only typecheck.
- If any `supabase` test file changed: `cd supabase && deno test --allow-all --config __tests__/deno.json __tests__/`.
- Format only the files you touched: `cd src && npx prettier --write <file>` for app files, `cd supabase && deno fmt <file>` for Deno files. Never pass a path through `npm run format` — its script carries its own `.` target and would rewrite the whole tree.
- Skip lint unless a deletion plausibly left unused imports behind; if you run anything, report the actual result.

### Step 7: Commit or leave in tree

- **Diff and path modes:** leave everything in the working tree uncommitted — the user reviews with `git diff` first.
- **Whole-repo mode:** after an area verifies green, commit it before starting the next. Stage the files by name (never `git add -A` — it would sweep in unrelated local edits) with message `Optimize <area> for readability`. If on `main`, create a branch before the first commit. No co-author lines.

### Step 8: Report

```
Readability pass complete (<scope>):
- Tests: <n> deleted across <m> files — one line each: file, test name, category cited
- Docs: <n> sections re-authored — file, section, before → after line counts
- Comments: <n> blocks compressed, <n> deleted
- Kept deliberately: <DEX-xxx pins, security tests, JSDoc tags with real value>
- Verification: <suites and typecheck run, with actual results>
```

In diff and path modes, end with: `Review with git diff HEAD before committing.` A pass that finds nothing to trim is a valid outcome — say so plainly rather than manufacturing edits.

## Important

- **This skill applies changes directly, including test deletions.** Review the result with `git diff HEAD` before committing.
- **No behavior changes, ever.** A bug, a rename, or a refactor you notice along the way is out of scope — note it in the report and move on.
- **Never `.skip` a test** — delete it or keep it.
- **When unsure whether a test earns its keep, keep it.** Deletions here should be confident, category-cited calls, not judgment coin-flips.
- **`CLAUDE.md`, `AGENTS.md`, `CHANGELOG.md`, and `.claude/**` are off limits** in every mode.
