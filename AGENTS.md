# AI Agents

Dexter is a planner product delivered as an Expo (React Native) app with iOS, Android, and web support, backed by Supabase (PostgreSQL + Deno Edge Functions).

This file is the working guide for AI/code agents in this monorepo.

**IMPORTANT: When reading this file, agents must log/echo "AGENT RULES READ"**

## Monorepo at a glance

- **GitHub**: `cvburgess/dexter`
- `/src` — Expo (React Native) application
- `/supabase` — Supabase backend (Edge Functions + config + migrations)
- `/www` — Lume marketing website for `dexterplanner.com`
- `/docs` — Engineering documentation
- `/scripts` — Repo-level developer utilities (not shipped with any app)

**Marketing website:** Source lives in `/www` and deploys to **[https://dexterplanner.com](https://dexterplanner.com)**. See `docs/website.md`.

## Task routing

- If work is mobile app UX, screens, hooks, navigation, or client data flow, start in `/src`.
- If work is schema, RLS, auth, storage, or API/function behavior, start in `/supabase`.
- If work is landing pages, marketing copy, SEO, or the Lume marketing site, start in `/www`.
- If requirements are unclear, read the matching docs under `/docs` before changing code.

## MCP servers

Agents may have access to MCP servers for common tasks (configure per environment), for example:

- **Supabase** — Database, migrations, RLS, Edge Functions
- **Expo** — Builds, EAS, metadata
- **Linear** — Issue tracking via the Linear MCP server. All product issue tracking uses Linear; GitHub (`gh`) is for pull requests, releases, and repository metadata only. Default Linear team for this repo: **`DEX`** — pass `team: "DEX"` in `save_issue` unless the user specifies otherwise. Board: https://linear.app/cvburgess/team/DEX/all

## Global standards

- Use TypeScript everywhere possible.
- Do not introduce `any` unless there is a documented, unavoidable boundary.
- Prefer small, focused changes over broad refactors.
- Keep naming explicit and consistent with existing patterns.
- Add tests for behavior changes when practical.
- Do not alter unrelated files.

## Agent behavior rules

- **No co-author lines:** Never add `Co-Authored-By` trailers to git commit messages.
- **No Claude Code footer:** Never add the "Generated with Claude Code" line to PR descriptions.
- **No script gymnastics:** Don't write complex Python or bash scripts to parse data or transcripts. Use simple, direct tool calls instead.
- **Hardcode known values:** Use `cvburgess/dexter` directly in skills, scripts, and `gh` commands — never use dynamic resolution like `gh repo view`.
- **Use AskUserQuestion for interactive skills:** Skills that ask the user questions (e.g. `/grill-me`) must use the `AskUserQuestion` tool, not plain text questions.
- **Grill-me step naming:** When integrating `/grill-me` into other skills, name the step "Collaborate on the plan" (not "Stress-test" or similar).

## Key constraints

**Supabase Edge Functions:** Run on Deno, not Node.js. Never import Node.js-only packages (e.g. `fs`, `path`, `child_process`). Use Deno equivalents (`std/fs`, `std/path`) or skip if not needed.

**Test file placement:** Never place test files inside `/src/app/` — Expo Router treats this directory as routes. Place tests in `__tests__/` directories adjacent to source files.

## App (`/src`)

Primary reference: `docs/frontend.md`

Common local commands:

- `cd src && npm install`
- `cd src && npm start`
- `cd src && npm test`
- `cd src && npm run lint`
- `cd src && npm run format`

## Supabase (`/supabase`)

Primary reference: `docs/backend.md`

Common local commands:

- `cd supabase && deno fmt`
- `cd supabase && deno test --allow-all --config __tests__/deno.json __tests__/` (add `--env-file=.env` when tests need secrets)

## Website (marketing)

Primary reference: `docs/website.md`

Common local commands:

- `cd www && deno task serve`
- `cd www && deno task build`

## Documentation map (`/docs`)

- `frontend.md` — **Read first for any `/src` work.** App architecture and commands
- `backend.md` — **Read first for any `/supabase` work.** Backend layout and operations
- `website.md` — Marketing site in `/www` and **dexterplanner.com**
- `testing.md` — Testing conventions

## Definition of done for agent changes

- Scope is fully addressed.
- Relevant checks/tests have been run (or explicitly noted if not run).
- Documentation is updated when behavior or developer workflow changes.
- Changes are concise, reviewable, and aligned with existing project patterns.

## Runtime requirements

- **Node.js >= 24** for `/src` (see `src/package.json` `engines`).
- **Deno v2.x** for `/supabase` Edge Functions and `/www`. Ensure `deno` is on your PATH.

## Running services

| Service | Command | Port | Notes |
|---------|---------|------|------|
| Expo (app + web) | `cd src && npm start` (or `npm run web`) | 8081 | Default Expo dev server |
| Marketing site | `cd www && deno task serve` | Lume default | Static marketing site |

## Gotchas

- **No `.env` files are committed.** Use local env files or your host's secret manager; document new `EXPO_PUBLIC_*` or function secrets in the relevant README or `docs/backend.md`.
- **Supabase local dev** (`supabase start`) requires Docker.
