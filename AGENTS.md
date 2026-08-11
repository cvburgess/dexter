# AI Agents

Dexter is a planner product delivered as an Expo (React Native) app with iOS, Android, and web support, backed by Supabase (PostgreSQL + Deno Edge Functions).

## Monorepo at a glance

- **GitHub**: `cvburgess/dexter`
- `/src` — Expo (React Native) application
- `/supabase` — Supabase backend (Edge Functions + config + migrations)
- `/www` — Lume marketing website for [dexterplanner.com](https://dexterplanner.com)
- `/docs` — Engineering documentation
- `/scripts` — Repo-level developer utilities (not shipped with any app)

**Issue tracking is Linear** (team `DEX`, board: https://linear.app/cvburgess/team/DEX/all — pass `team: "DEX"` in `save_issue`); GitHub (`gh`) is for pull requests, releases, and repository metadata only.

## Standards

- TypeScript everywhere; no `any` without a documented, unavoidable boundary.
- Small, focused changes; don't alter unrelated files.
- **No co-author lines** in commits and **no "Generated with Claude Code" footer** in PR descriptions.
- **No script gymnastics:** don't write complex Python/bash to parse data or transcripts — use simple, direct tool calls.
- **Hardcode known values:** use `cvburgess/dexter` directly in skills, scripts, and `gh` commands — never dynamic resolution like `gh repo view`.
- **Interactive skills use `AskUserQuestion`**, not plain-text questions; when integrating `/grill-me` into another skill, name the step "Collaborate on the plan".

## Key constraints

- **Supabase Edge Functions run on Deno, not Node.js.** Never import Node-only packages (`fs`, `path`, `child_process`); use Deno equivalents.
- **Never place test files inside `/src/app/`** — Expo Router treats that directory as routes. Tests live in `__tests__/` directories adjacent to source.
- **Migration ordering:** production applies migrations with `supabase db push --include-all`, so a migration can land *after* one with a later timestamp. Never write a migration that depends on a later-timestamped one; if two must land in order, ship them in one PR. See `docs/backend.md`.

## Commands

- App: `cd src && npm install | npm start | npm test | npm run lint | npm run typecheck | npm run format` (Node.js >= 24)
- Supabase (Deno v2.x): `cd supabase && deno fmt`; tests: `deno test --allow-all --config __tests__/deno.json __tests__/` (add `--env-file=.env` for secrets); entrypoints: `deno check --config functions/<name>/deno.json functions/<name>/index.ts` — **`deno test` does not type-check entrypoints**, CI checks every function.
- Website: `cd www && deno task serve | deno task build`

## Documentation map (`/docs`)

- `frontend.md` — **Read first for any `/src` work.** App architecture, conventions, build/tooling gotchas
- `design.md` — **Read before touching any style value.** The token system in `src/utils/theme.ts`
- `backend.md` — **Read first for any `/supabase` work.** Backend layout and operations
- `testing.md` — Which tests are worth writing, and the test-harness gotchas
- `website.md` — Marketing site in `/www` and dexterplanner.com
- `appstore.md` — App Store Connect metadata, IDs, and screenshot rules

### Which docs are worth writing

Docs exist to hold what the code cannot say: **gotchas, counterfactuals ("X was tried and failed because Y"), team opinions, and constraints invisible at the point of use**. Do not write file listings, command tables, workflow enumerations, feature narratives, or per-change changelogs — the repo and its git history already answer those, and prose copies drift stale. Delegate procedures to skills; keep docs to facts and rules. Prefer tightening an existing section over adding a new one, and when a change makes a paragraph obsolete, delete it in the same PR.

## Gotchas

- **No plaintext `.env` files are committed.** The one exception is `supabase/.env.preview` (dotenvx-encrypted for preview branches); its private key `supabase/.env.keys` is gitignored and must never be committed. See `docs/backend.md`.
- **Supabase local dev** (`supabase start`) requires Docker.
- **A green `npm test` is not a typecheck** — Jest strips types without checking them. Run `npm run typecheck` alongside the tests.
- **`npm run lint` is `eslint .`, not `expo lint` (DEX-95)** — `expo lint` silently skipped 46% of the app while exiting 0. Don't switch it back.
- **Don't pass a file path through `npm run lint`/`npm run format`** — both scripts carry their own `.` target, so an appended path rewrites the whole tree. Use `npx eslint --fix <file>` / `npx prettier --write <file>`.
- **Expo's generated type files are gitignored, so local and CI type-checking differ.** A stale `.expo/types/router.d.ts` fails typecheck on a route that exists (start the dev server once), and CI lacks the generated files entirely — `src/global.d.ts` compensates; don't remove it. Details in `docs/frontend.md`.
- **Applying `expo-doctor`'s version bumps means regenerating the lockfile (DEX-116)** — `rm -rf node_modules package-lock.json && npm install` in `/src`; repairing the old lock does not work, and the regen floats every range, so re-run all four checks and re-verify `patches/`. Details in `docs/frontend.md`.
