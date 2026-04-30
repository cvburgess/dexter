---
name: review-as-staff
description: Review code as a staff-level engineer for simplicity, elegance, and clean code. Accepts file paths or reviews the current branch diff against main.
argument-hint: [optional file paths, e.g. src/utils/errors.ts src/hooks/useAuth.ts]
allowed-tools: Bash(git diff*), Read, Grep, Glob, Agent, AskUserQuestion
---

# Staff-Level Code Review

Review code with a staff engineer's eye: simplicity, elegance, clarity, and correctness. Only suggest changes that genuinely improve the code — do not nitpick or pad the review.

## Instructions

### Step 1: Determine the review scope

- If `$ARGUMENTS` contains file paths, review those files.
- Otherwise, review the diff between the current branch and `main`:

```bash
git diff main...HEAD
```

If there is no diff and no arguments were provided, inform the user and stop.

### Step 2: Read the code

Read the relevant architecture doc based on which files are being reviewed:

- Changes in `src/` → read [`docs/frontend.md`](docs/frontend.md)
- Changes in `supabase/` → read [`docs/backend.md`](docs/backend.md)
- Changes to tests → read [`docs/testing.md`](docs/testing.md)
- Changes in both `src/` and `supabase/` → read both architecture docs

Read each file or changed file in full. Understand the context — what the code does, how it fits into the surrounding module, and what patterns are already in use.

When reviewing a diff, focus on the changed lines but read enough surrounding context to evaluate whether changes are consistent with the rest of the file.

### Step 3: Review

Evaluate the code for:

- **Simplicity** — Is there unnecessary complexity? Could the same thing be expressed more directly?
- **Clarity** — Is the intent obvious? Are names precise? Would a reader understand this without extra context?
- **Correctness** — Are there bugs, edge cases, or missed error paths?
- **Consistency** — Does it follow the patterns already established in the codebase?
- **Unnecessary code** — Dead code, redundant checks, over-abstraction, speculative generality?

Do NOT flag:
- Style preferences that don't affect readability
- Missing comments or docs on self-explanatory code
- Suggestions that add complexity without clear payoff
- Hypothetical future improvements

### Step 4: Present findings

For each issue found, explain:
1. **What** the issue is (with file path and line reference)
2. **Why** it matters
3. **How** to fix it (with a concrete code suggestion)

If the code is clean and there's nothing substantive to flag, say so. A clean review with no suggestions is a valid outcome.

## Important

- Read the code before forming opinions — don't review from the diff alone
- Fewer high-quality suggestions beat many low-value ones
- Respect existing patterns even if you'd choose differently on a blank slate
- Never suggest changes that alter behavior unless there's a bug
