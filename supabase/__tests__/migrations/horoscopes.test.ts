import { assert, assertEquals, assertStringIncludes } from "@std/assert";

import { statements, withoutComments } from "./sqlStatements.ts";
import { ZODIAC_SIGNS } from "../../functions/generate-horoscopes/astrology.ts";

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
  const enumBlock = code.slice(code.indexOf("create type public.sun_sign"));
  const declared = enumBlock
    .slice(enumBlock.indexOf("("), enumBlock.indexOf(")"))
    .match(/'([a-z]+)'/g)
    ?.map((value) => value.replaceAll("'", ""));

  assertEquals(
    declared,
    [...ZODIAC_SIGNS],
    "the enum and ZODIAC_SIGNS must agree, in order — the function writes one row per sign and a mismatch fails at insert time",
  );
});

Deno.test("the sentiment enum is exactly the three labels the prompt can return", () => {
  const enumBlock = code.slice(
    code.indexOf("create type public.horoscope_sentiment"),
  );
  const declared = enumBlock
    .slice(enumBlock.indexOf("("), enumBlock.indexOf(")"))
    .match(/'([a-z]+)'/g)
    ?.map((value) => value.replaceAll("'", ""));

  assertEquals(declared, ["positive", "negative", "mixed"]);
});

Deno.test("both enums are created behind a to_regtype guard", () => {
  // `create type` has no IF NOT EXISTS, and production replays migrations with
  // `db push --include-all`, so an unguarded one breaks on replay.
  for (const type of ["public.sun_sign", "public.horoscope_sentiment"]) {
    assertStringIncludes(code, `if to_regtype('${type}') is null then`);
  }
});

Deno.test("the primary key is (sun_sign, date), in that order", () => {
  const create = all.find((statement) =>
    statement.includes("create table if not exists public.horoscopes")
  );
  assert(create, "the horoscopes table must be created");
  assertStringIncludes(
    create,
    "primary key (sun_sign, date)",
    "sun_sign must lead: the leftmost-prefix rule means only this order also serves `where sun_sign = $1 order by date desc`",
  );
});

Deno.test("average_rating is a stored generated column over all six ratings", () => {
  const create = all.find((statement) =>
    statement.includes("create table if not exists public.horoscopes")
  )!;
  const generated = create.slice(create.indexOf("average_rating"));

  assertStringIncludes(generated, "generated always as");
  assertStringIncludes(
    generated,
    "stored",
    "a virtual generated column would not be readable by PostgREST",
  );
  for (
    const facet of [
      "personal_life_rating",
      "profession_rating",
      "health_rating",
      "emotions_rating",
      "travel_rating",
      "luck_rating",
    ]
  ) {
    assertStringIncludes(
      generated.slice(0, generated.indexOf("stored")),
      facet,
      `${facet} must be part of the average — the issue defines it as the mean of all six`,
    );
  }
});

Deno.test("every rating column is bounded 0..10", () => {
  const create = all.find((statement) =>
    statement.includes("create table if not exists public.horoscopes")
  )!;

  for (
    const facet of [
      "personal_life_rating",
      "profession_rating",
      "health_rating",
      "emotions_rating",
      "travel_rating",
      "luck_rating",
    ]
  ) {
    assertStringIncludes(
      create,
      `check (${facet} between 0 and 10)`,
      `${facet} is unvalidated third-party input and must be bounded in the database`,
    );
  }
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

Deno.test("no grant widens the table beyond reads for users", () => {
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
    "these are the only two grants this table should carry — `authenticated` reads, `service_role` writes, and nothing gets DELETE",
  );

  assert(
    all.some((statement) =>
      statement === "revoke all on public.horoscopes from anon, authenticated"
    ),
    "the inherited default privileges must be revoked explicitly so the intent is legible in \\dp",
  );
});

Deno.test("service_role is granted DML explicitly rather than by inheritance", () => {
  // The trap this pins: `alter default privileges` on this stack grants only
  // Dxt (truncate/references/trigger) to service_role on new public tables, and
  // BYPASSRLS exempts a role from policies but not from grants. Without an
  // explicit grant the Edge Function's upsert fails with "permission denied"
  // while RLS never even fires.
  assert(
    all.some(
      (statement) =>
        statement.includes("grant") &&
        statement.includes("service_role") &&
        statement.includes("insert") &&
        statement.includes("update"),
    ),
    "service_role must be granted INSERT and UPDATE explicitly — it does not inherit them",
  );
});

Deno.test("the table is not added to the realtime publication", () => {
  assert(
    !code.includes("supabase_realtime"),
    "horoscopes change once a day at a fixed hour; a subscription would idle 24 hours to deliver what a refetch already gets",
  );
});
