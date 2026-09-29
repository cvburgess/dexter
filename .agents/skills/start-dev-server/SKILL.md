---
name: start-dev-server
description: Start the Expo dev server for this checkout, pointed at the right Supabase project. Copies missing .env files into a fresh worktree, picks production or the branch's Supabase preview branch, stops this checkout's old server, and starts on a free port. Use when the user says "start the dev server", "run the app", "test against the preview branch", "use main branch", "switch back to prod", or "stop using the preview branch". Pass `prod` or `preview` to force the environment.
allowed-tools: Bash(.agents/skills/start-dev-server/scripts/*), Bash(git branch*), Bash(cd src && npm start*)
---

# Start Dev Server

Point `src/.env.local` at the right Supabase project and start Expo from `src/`.

## Hardcoded values

These are stable and should be used directly. Never resolve them dynamically.

| Field | Value |
|---|---|
| Prod Supabase URL | `https://api.dexterplanner.com` |
| Parent (prod) project ref | `isreileykodwkyedcewv` |
| Main checkout path | `/Users/charlesburgess/Documents/GitHub/dexter` |

## Instructions

Run every script from the repo root (or worktree root).

### Step 1: Copy missing env files

```bash
.agents/skills/start-dev-server/scripts/copy-env-files.sh
```

A fresh worktree has none of the gitignored `.env*` files. This copies each missing one from the main checkout and never overwrites.

### Step 2: Resolve the environment

The argument (`prod` or `preview`) forces the mode. Without one:

- `git branch --show-current` is `main` or empty (detached HEAD) → **prod**. Skip the Supabase lookup.
- Any other branch → run the preview lookup below. Exit 0 → **preview**; exit 3 (no preview branch) → **prod**.

```bash
.agents/skills/start-dev-server/scripts/get-preview-env.sh
```

It prints `PREVIEW_REF`, `PREVIEW_URL`, and `PREVIEW_KEY` (the `sb_publishable_` key). Exit 1 means the Supabase CLI or auth failed; report it and stop rather than falling back. With a forced `preview`, exit 3 is an error too: preview branches only exist when the PR touches `supabase/migrations/`. Report that and stop without touching `src/.env.local`.

### Step 3: Update `src/.env.local`

```bash
.agents/skills/start-dev-server/scripts/swap-env.sh --prod
.agents/skills/start-dev-server/scripts/swap-env.sh --preview <PREVIEW_URL> <PREVIEW_KEY>
```

Run the one matching the mode. The script toggles the pairs under `# Supabase` and `# Preview branch`, leaves every other line untouched, is idempotent, and refuses non-`sb_publishable_` keys. Do not hand-edit the file. If it reports no active prod pair, restore the `# Supabase` section from the main checkout's `src/.env.local` and rerun.

### Step 4: Free a port

```bash
.agents/skills/start-dev-server/scripts/free-port.sh
```

This stops any server already running from this checkout's `src/` (Expo reads `.env` only at startup, so it must restart) and prints the first free port from 8081. Other worktrees' servers keep running.

### Step 5: Start the server

Run as a background task, with the port from Step 4:

```bash
cd src && npm start -- --port <PORT>
```

It's ready when the output shows `Waiting on http://localhost:<PORT>`. If it exits instead, read its output before waiting further.

### Step 6: Report

Tell the user the port and the environment:

- **Prod:** the app points at `https://api.dexterplanner.com`.
- **Preview:** the preview ref and `PREVIEW_URL`. Preview branches share only migrations and `supabase/seed.sql`, not production data, so they'll need to sign up fresh. Run `/start-dev-server prod` to switch back.

## Important

- `src/.env.local` is gitignored, so these changes never land in a commit.
- Only the public `sb_publishable_` key belongs in `src/.env.local`. Never write the `anon` JWT, `service_role`, or `sb_secret_` keys.
- Do not run `supabase link`. The scripts use `--project-ref` so the linked project stays untouched.
