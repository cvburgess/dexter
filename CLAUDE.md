# AI Agents

Dexter is a planner product delivered as an Expo (React Native) app with iOS, Android, and web support, backed by Supabase (PostgreSQL + Deno Edge Functions).

This file is the working guide for AI/code agents in this monorepo.

**IMPORTANT: When reading this file, agents must log/echo "AGENT RULES READ"**

## Monorepo at a glance

- **GitHub**: `cvburgess/dexter`
- `/src` — Expo (React Native) application
- `/supabase` — Supabase backend (Edge Functions + config + migrations)
- `/docs` — Engineering documentation

**Marketing website:** Not in this repo. Source lives in **[cvburgess/dexter-www](https://github.com/cvburgess/dexter-www)** and deploys to **[https://dexterplanner.com](https://dexterplanner.com)**. See `docs/website.md`.

## Task routing

- If work is mobile app UX, screens, hooks, navigation, or client data flow, start in `/src`.
- If work is schema, RLS, auth, storage, or API/function behavior, start in `/supabase`.
- If work is landing pages, marketing copy, SEO, or the Lume marketing site, work in the **dexter-www** repository (see `docs/website.md`), not in this monorepo.
- If requirements are unclear, read the matching docs under `/docs` before changing code.

## MCP servers

Agents may have access to MCP servers for common tasks (configure per environment), for example:

- **Supabase** — Database, migrations, RLS, Edge Functions
- **Expo** — Builds, EAS, metadata

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

- `cd src && npm install --legacy-peer-deps`
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

Develop and run the site from **[cvburgess/dexter-www](https://github.com/cvburgess/dexter-www)**. Do not add a duplicate Lume tree under this repo unless the team explicitly consolidates repositories.

## Documentation map (`/docs`)

- `frontend.md` — **Read first for any `/src` work.** App architecture and commands
- `backend.md` — **Read first for any `/supabase` work.** Backend layout and operations
- `website.md` — Marketing site (dexter-www) and **dexterplanner.com**
- `testing.md` — Testing conventions

## Definition of done for agent changes

- Scope is fully addressed.
- Relevant checks/tests have been run (or explicitly noted if not run).
- Documentation is updated when behavior or developer workflow changes.
- Changes are concise, reviewable, and aligned with existing project patterns.

## Runtime requirements

- **Node.js >= 24** for `/src` (see `src/package.json` `engines`).
- **Deno v2.x** for `/supabase` Edge Functions. Ensure `deno` is on your PATH.

## Running services

| Service | Command | Port | Notes |
|---------|---------|------|------|
| Expo (app + web) | `cd src && npm start` (or `npm run web`) | 8081 | Default Expo dev server |
| Marketing site | Clone **dexter-www** and use `deno task serve` there | (see dexter-www) | Not started from this repo |

## Gotchas

- **`npm install` may require `--legacy-peer-deps`** in `/src` when peer dependencies conflict (e.g. React 19 with test tooling). Use the same flag as documented in `docs/frontend.md` if install fails.
- **No `.env` files are committed.** Use local env files or your host's secret manager; document new `EXPO_PUBLIC_*` or function secrets in the relevant README or `docs/backend.md`.
- **Supabase local dev** (`supabase start`) requires Docker.
