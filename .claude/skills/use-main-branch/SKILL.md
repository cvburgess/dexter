---
name: use-main-branch
description: Point the local Expo app back at the production Supabase project by swapping the preview/prod Supabase lines in src/.env.local (uncomment prod, comment out preview). Use when done testing against a Supabase preview branch and want to return to production, or whenever the user says "use main branch", "switch back to prod", "go back to production Supabase", or "stop using the preview branch". This is the inverse of use-preview-branch.
allowed-tools: Bash(.claude/skills/use-preview-branch/scripts/swap-env.sh*), Bash(cd src && npm start*)
---

# Use Main Branch

Switch the local Expo app from a Supabase preview branch back to the production project by toggling the comments in `src/.env.local`. This is the inverse of [use-preview-branch](../use-preview-branch/SKILL.md).

## Hardcoded values

These are stable and should be used directly. Never resolve them dynamically.

| Field | Value |
|---|---|
| Prod Supabase URL | `https://api.dexterplanner.com` |
| Main checkout path | `/Users/charlesburgess/Documents/GitHub/dexter` |

## Instructions

### Step 1: Toggle the Supabase lines

Run the shared swap script (it lives in the `use-preview-branch` skill; both skills use it) from the repo root (or worktree root):

```bash
.claude/skills/use-preview-branch/scripts/swap-env.sh --prod
```

The script uncomments the prod pair under `# Supabase`, comments out the preview pair under `# Preview branch` (preserving its values for a later switch back), and leaves every other line (Sentry, etc.) untouched. It is idempotent — if the file already points at prod it reports "no changes made" — and copies `src/.env.local` from the main checkout first if it's missing (fresh worktree). Do not hand-edit the file; the script supersedes manual edits.

If the script reports that no active prod pair exists after the swap, restore the `# Supabase` section from the main checkout's `src/.env.local` (the publishable key is public) and rerun.

### Step 2: Restart the dev server

If the Expo dev server is running, it must be restarted to pick up the new env values (Expo only reads `.env` at startup). If it isn't running and the user wants it, start `npm start` from `src/` as a background task; otherwise just remind them to restart.

### Step 3: Report

Tell the user the app now points at production (`https://api.dexterplanner.com`) and that they should restart the dev server if it was running.

## Important

- `src/.env.local` is gitignored, so this change never lands in a commit.
- Only the public `sb_publishable_` key belongs in `src/.env.local`. Never write the `anon` JWT, `service_role`, or `sb_secret_` keys.
- Do not run `supabase link` or otherwise change the linked project.
