---
name: review-as-staff
description: Staff-level code review of the current branch diff — orchestrates /code-review high and /simplify, applying fixes. Reviews the diff against main.
allowed-tools: Bash(git diff*), Read, Skill
---

# Staff-Level Code Review

Review the current branch as a staff engineer would — with an eye for correctness, simplicity, elegance, and clarity. This skill is a thin orchestrator: it delegates the actual review to the built-in `/code-review` and `/simplify` skills, which surface findings **and apply fixes** to the working tree. Your job is to set the scope, load the right architecture context, run the two skills in order, and report a combined summary.

## Instructions

### Step 1: Determine the review scope

This review is **diff-only**: it always reviews the changes on the current branch relative to `main`.

```bash
git diff main...HEAD
```

If there is no diff, inform the user that there is nothing to review and stop — do not invoke either review skill. (File-path arguments are not supported; scope is always the branch diff.)

### Step 2: Read the code

Read the relevant architecture doc based on which directories changed, so you can evaluate the delegated findings with the right context:

- Changes in `src/` → read [`docs/frontend.md`](docs/frontend.md)
- Changes in `supabase/` → read [`docs/backend.md`](docs/backend.md)
- Changes to tests → read [`docs/testing.md`](docs/testing.md)
- Changes in both `src/` and `supabase/` → read both architecture docs

Understand what the changed code does and how it fits the surrounding module before running the review skills.

### Step 3: Run `/code-review` at high effort, applying fixes

Invoke the built-in `/code-review` skill via the `Skill` tool with `code-review` and arguments `high --fix`. This runs a deep review for correctness bugs plus reuse/simplification/efficiency cleanups at `high` effort and applies the resulting fixes to the working tree.

### Step 4: Run `/simplify`, applying fixes

Invoke the built-in `/simplify` skill via the `Skill` tool with `simplify` (no arguments). This performs quality cleanups only — reuse, simplification, efficiency, and altitude — and applies the fixes by design. It does not hunt for bugs; that coverage comes from Step 3.

### Step 5: Present a combined summary

Report a single combined summary covering:

- What `/code-review high` surfaced and applied (correctness bugs + cleanups)
- What `/simplify` surfaced and applied (quality cleanups)
- Anything either skill flagged but did not fix, and any follow-ups worth a human's attention

If both skills came back clean with nothing to apply, say so — a clean review is a valid outcome.

## Important

- This skill **applies fixes** — it is no longer advisory-only. Review the applied changes (`git diff`) before committing.
- Bug coverage comes from `/code-review`; quality cleanups come from `/simplify`. Run both, in that order.
- Scope is always the current branch diff against `main`. File-path arguments are not supported.
- If there is no diff against `main`, stop without invoking either skill.
