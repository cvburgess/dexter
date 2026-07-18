---
name: use-preview-branch
description: Point the local Expo app at the Supabase preview branch for the current git branch by swapping the prod/preview Supabase lines in src/.env.local, then start the dev server. Use when testing a PR against its Supabase preview branch.
allowed-tools: Bash(.claude/skills/use-preview-branch/scripts/*), Bash(git branch*), Bash(cd src && npm start*)
---

# Use Preview Branch

Switch the local Expo app from production Supabase to the preview branch that the Supabase GitHub integration created for the current git branch, then start the dev server.

## Hardcoded values

These IDs are stable and should be used directly. Never resolve them dynamically.

| Field | Value |
|---|---|
| Parent (prod) project ref | `isreileykodwkyedcewv` |
| Main checkout path | `/Users/charlesburgess/Documents/GitHub/dexter` |

## Instructions

### Step 1: Resolve the preview branch env

Run from the repo root (or worktree root):

```bash
.claude/skills/use-preview-branch/scripts/get-preview-env.sh
```

This resolves the current git branch, finds the matching Supabase preview branch, and prints `PREVIEW_REF`, `PREVIEW_URL`, and `PREVIEW_KEY` (the `sb_publishable_` key). It fails with a clear message when:

- HEAD is detached (a branch is required), or
- no preview branch exists for this git branch — preview branches are only created when the PR touches `supabase/migrations/`. Report that to the user and stop.

### Step 2: Update `src/.env.local`

Run the swap script with the values from Step 1:

```bash
.claude/skills/use-preview-branch/scripts/swap-env.sh --preview <PREVIEW_URL> <PREVIEW_KEY>
```

The script comments out the prod pair under `# Supabase`, writes the preview pair under `# Preview branch`, and leaves every other line (Sentry, etc.) untouched. It is idempotent, copies `src/.env.local` from the main checkout first if it's missing (fresh worktree), and refuses non-`sb_publishable_` keys. Do not hand-edit the file; the script supersedes manual edits.

### Step 3: Start the dev server

Run `npm start` from `src/` as a background task.

### Step 4: Report

Tell the user:

- The preview branch ref and URL (`https://<preview_ref>.supabase.co`).
- Preview branches don't share production's data (only its migrations and `supabase/seed.sql`), so they'll need to sign in/sign up fresh on the preview branch.
- To remind them to revert `src/.env.local` (run `/use-main-branch`) when done testing against the preview.

## Reverting

To point back at production, run the same script's inverse mode (this is what the `use-main-branch` skill does):

```bash
.claude/skills/use-preview-branch/scripts/swap-env.sh --prod
```

## Important

- `src/.env.local` is gitignored, so this change never lands in a commit.
- Only ever write the `sb_publishable_` key into `src/.env.local`. Never the `anon` JWT, `service_role`, or `sb_secret_` keys. The script enforces this.
- Do not run `supabase link`. The scripts use `--project-ref` flags so the linked project stays untouched.
