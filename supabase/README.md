# Supabase (`/supabase`)

Deno Edge Functions (`functions/`), ordered SQL migrations (`migrations/`), and
Supabase CLI configuration for Dexter.

The rules for any table, migration, or function — RLS invariants, realtime,
secrets, deployment — live in [`../docs/backend.md`](../docs/backend.md); each
endpoint's own contract is in [`../docs/api-routes.md`](../docs/api-routes.md),
and what a given table stores is in
[`../docs/features.md`](../docs/features.md). Commands are in
[`../AGENTS.md`](../AGENTS.md). `supabase start` requires Docker.
