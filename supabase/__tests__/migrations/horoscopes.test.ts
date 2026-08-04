import { assert, assertEquals, assertStringIncludes } from "@std/assert";

import { statements, withoutComments } from "./sqlStatements.ts";
import {
  PREDICTION_FACETS,
  ZODIAC_SIGNS,
} from "../../functions/generate-horoscopes/astrology.ts";
import { SENTIMENTS } from "../../functions/generate-horoscopes/summarize.ts";

/** The enum labels declared in a `create type ... as enum (...)` block. */
function enumLabels(typeName: string): string[] | undefined {
  const block = code.slice(code.indexOf(`create type ${typeName}`));
  return block
    .slice(block.indexOf("("), block.indexOf(")"))
    .match(/'([a-z_]+)'/g)
    ?.map((value) => value.replaceAll("'", ""));
}

// DEX-84: static guards over the horoscopes table.
//
// Backend CI has no Postgres, so these assert over the migration text. The
// privilege assertions matter most: RLS misconfiguration and an over-broad
// grant both fail *open*, so nothing at runtime would complain.

const sql = (
  await Deno.readTextFile(
    new URL(
      "../../migrations/20260804005118_add_horoscopes.sql",
      import.meta.url,
    ),
  )
).toLowerCase();

const code = withoutComments(sql);
const all = statements(sql);

Deno.test("the sun_sign enum matches the signs the function requests", () => {
  assertEquals(
    enumLabels("public.sun_sign"),
    [...ZODIAC_SIGNS],
    "the enum and ZODIAC_SIGNS must agree, in order — the function writes one row per sign and a mismatch fails at insert time",
  );
});

Deno.test("the sentiment enum is exactly the labels the prompt can return", () => {
  assertEquals(
    enumLabels("public.horoscope_sentiment"),
    [...SENTIMENTS],
    "adding a label to the enum without adding it to SENTIMENTS leaves the schema and the prompt disagreeing, with nothing red",
  );
});

Deno.test("both enums are created behind a to_regtype guard", () => {
  // `create type` has no IF NOT EXISTS, and production replays migrations with
  // `db push --include-all`, so an unguarded one breaks on replay.
  for (const type of ["public.sun_sign", "public.horoscope_sentiment"]) {
    assertStringIncludes(code, `if to_regtype('${type}') is null then`);
  }
});

const create = all.find((statement) =>
  statement.includes("create table if not exists public.horoscopes")
);

Deno.test("the table is created", () => {
  assert(create, "every other assertion in this file depends on it");
});

Deno.test("the primary key is (sun_sign, date), in that order", () => {
  assertStringIncludes(
    create!,
    "primary key (sun_sign, date)",
    "sun_sign must lead: the leftmost-prefix rule means only this order also serves `where sun_sign = $1 order by date desc`",
  );
});

Deno.test("every facet the upstream returns has a NOT NULL column", () => {
  for (const facet of PREDICTION_FACETS) {
    assertStringIncludes(
      create!,
      `${facet} text not null`,
      `${facet} is parsed out of every response, so it needs a column`,
    );
  }
});

Deno.test("no rating columns, matching what the API actually returns", () => {
  // DEX-84's sample response (2024) carried a `<facet>_rating` integer per
  // facet and an `average_rating` derived from them, but the live API returns
  // only the six text facets — verified 2026-08-04 across four endpoints. NOT
  // NULL rating columns would have failed every insert, and `average_rating`
  // had nothing to average. Pinned so nobody restores them from the issue text
  // without first re-checking a live response.
  assert(
    !create!.includes("_rating"),
    "the upstream no longer sends ratings; re-check a live response before adding these back",
  );
  assert(
    !create!.includes("generated always as"),
    "there is nothing left to generate from",
  );
});

Deno.test("RLS is enabled with a read-only policy and no write policy", () => {
  assertStringIncludes(
    code,
    "alter table public.horoscopes enable row level security",
  );

  // Policies are written with quoted identifiers (`"public"."horoscopes"`) to
  // match the rest of this schema, so match on the bare table name.
  const policies = all.filter(
    (statement) =>
      statement.startsWith("create policy") && statement.includes("horoscopes"),
  );
  assertEquals(
    policies.length,
    1,
    "exactly one policy: horoscopes are read-only to users",
  );
  assertStringIncludes(policies[0], "for select");
  assertStringIncludes(policies[0], 'to "authenticated"');
  assertStringIncludes(
    policies[0],
    "using (true)",
    "the rows are global, so there is no user_id to compare against",
  );
});

Deno.test("the table carries exactly the grants it needs, and no others", () => {
  // Both halves of this matter, and neither is inherited. `alter default
  // privileges` on this stack grants only Dxt (truncate/references/trigger) to
  // anon/authenticated/service_role on new public tables, and the baseline's
  // blanket `grant all on all tables` was a one-time snapshot. So `service_role`
  // does not get INSERT for free — BYPASSRLS exempts a role from policies, not
  // from grants, and without the explicit grant the Edge Function's upsert fails
  // with "permission denied" while RLS never even fires. Equally, nothing here
  // may widen: an over-broad grant fails *open*, silently.
  const grants = all.filter(
    (statement) =>
      statement.startsWith("grant") && statement.includes("public.horoscopes"),
  );

  assertEquals(
    grants.sort(),
    [
      "grant select on public.horoscopes to authenticated",
      "grant select, insert, update on public.horoscopes to service_role",
    ].sort(),
    "`authenticated` reads, `service_role` writes, and nothing gets DELETE",
  );

  assert(
    all.some((statement) =>
      statement === "revoke all on public.horoscopes from anon, authenticated"
    ),
    "the inherited default privileges must be revoked explicitly so the intent is legible in \\dp",
  );
});

Deno.test("the table is not added to the realtime publication", () => {
  assert(
    !code.includes("supabase_realtime"),
    "horoscopes change once a day at a fixed hour; a subscription would idle 24 hours to deliver what a refetch already gets",
  );
});
