# Supabase scripts

Operational Deno scripts for the Supabase backend. Run them from this directory
so Deno picks up `deno.json` (import map + tasks).

## `seed-demo.ts` — reset the demo account

Resets a stable App Store review / marketing demo user to a curated, known-good
dataset (lists, goals, habits with daily progress, and tasks covering every
priority and status — including overdue, left-behind, unscheduled, completed,
won't-do, and alarm cases — plus notes and journal entries). It is
**idempotent**: it looks up the demo user by email (creating it via the Auth
Admin API if missing), deletes that user's existing rows, and re-inserts the
curated set. Run it as often as you like.

The curated data lives in `demoData.ts`, a pure module (no IO) so it can be
unit-tested without a database — see `../__tests__/scripts/demoData.test.ts`.
Adjust the demo data there.

### Usage

```bash
cd supabase/scripts

SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
DEMO_OTP=... \
deno task seed-demo
```

The demo account's email is the shared `DEMO_EMAIL` constant
(`../functions/_shared/demoAuth.ts`), and its password is **derived from
`DEMO_OTP`** — the same fixed code the `verify-demo-otp` Edge Function uses to
sign the App Store reviewer in — so the two never drift. Set the same `DEMO_OTP`
here and as the function's secret; if you change it, re-run this script so the
stored password matches.

The **service-role key bypasses RLS** and has full database access — it is a
secret. Only ever supply it (and `DEMO_OTP`) via the environment; never commit
these values. Point `SUPABASE_URL` at whichever project holds the demo account
(a local `supabase start` stack, a preview branch, or the hosted project used
for App Store review).
