import { assert, assertEquals, assertStringIncludes } from "@std/assert";

import { statements, withoutComments } from "./sqlStatements.ts";

// DEX-84: static guards over the pg_cron wiring.
//
// The first assertion is the one that earns this file. Preview branches replay
// every migration against a different project ref, so a hardcoded endpoint here
// would put every open pull request's database on a daily timer pointed at
// production. That regression costs real money and nothing else would catch it.

const sql = (
  await Deno.readTextFile(
    new URL(
      "../../migrations/20260804005119_schedule_generate_horoscopes.sql",
      import.meta.url,
    ),
  )
).toLowerCase();

// `withoutComments` is mandatory here, not stylistic: the header legitimately
// discusses the endpoint, so asserting over the raw file would fail on prose.
const code = withoutComments(sql);
const all = statements(sql);

Deno.test("no endpoint is hardcoded in executable SQL", () => {
  for (
    const needle of ["https://", "http://", ".supabase.co", "functions/v1"]
  ) {
    assert(
      !code.includes(needle),
      `executable SQL contains "${needle}" — the endpoint must come from Vault, or every preview branch will POST at production on a daily timer`,
    );
  }
});

Deno.test("the endpoint and secret are read from Vault by name", () => {
  assertStringIncludes(code, "vault.decrypted_secrets");
  assertStringIncludes(code, "'generate_horoscopes_url'");
  assertStringIncludes(code, "'generate_horoscopes_secret'");
});

Deno.test("an unprovisioned environment no-ops instead of erroring", () => {
  // Preview branches and every local `db reset` have an empty Vault. The job is
  // scheduled there too, so the skip path is what keeps it silent rather than
  // failing loudly every morning.
  assertStringIncludes(
    code,
    "return null",
    "the trigger must return NULL when the secrets are absent",
  );
  assertStringIncludes(
    code,
    "exception",
    "an unreadable Vault (a dump restored into another project) must be caught, not raised",
  );
});

Deno.test("cron.schedule uses the named three-argument form", () => {
  // The two-argument form inserts a new row with a NULL jobname on every call,
  // so a replay under `db push --include-all` silently duplicates the job.
  assertStringIncludes(code, "'dex84-generate-horoscopes',");
  assertStringIncludes(code, "cron.unschedule(jobid)");
});

Deno.test("every run is between 05:00 and 10:00 UTC", () => {
  const match = code.match(
    /perform cron\.schedule\(\s*'[^']+',\s*'(\S+) (\S+) (\S+) (\S+) (\S+)'/,
  );
  assert(
    match,
    "the cron expression must be a literal so this bound can be checked",
  );

  const [, minute, hourField] = match;

  // The hour field is a comma list, so every entry has to be checked — reading
  // only the first would silently pass a `6,14,22` schedule whose later runs are
  // too late to be worth making.
  const hours = hourField.split(",");
  assert(
    hours.length >= 2,
    "gaps are repaired by re-running, so expect several",
  );

  for (const hour of hours) {
    const hourNumber = Number(hour);
    assert(
      Number.isInteger(hourNumber) && hourNumber >= 5 && hourNumber < 10,
      `a run at hour ${hour} UTC is outside 05:00–09:59. Later than 10:00 misses UTC+14's midnight, so the run can only fix a gap those users already saw; earlier than 05:00 makes the UTC date disagree with the upstream's, so "next" can return the day already stored (the DEX-117 hazard).`,
    );
  }

  assertEquals(
    [...hours].sort(),
    hours,
    "hours must be listed in order, so the schedule reads the way it runs",
  );
  assertEquals(minute, "0");
});

Deno.test("the trigger function is not executable by API roles", () => {
  // `public` is PostgREST-exposed, so an EXECUTE grant here would turn paid
  // upstream and LLM quota into a free RPC for anyone with a login.
  const revokes = all.filter(
    (statement) =>
      statement.startsWith("revoke") &&
      statement.includes("trigger_generate_horoscopes"),
  );
  assert(revokes.length > 0, "EXECUTE must be revoked from public");
  assert(
    revokes.some((statement) => statement.includes("from public")),
    "the default PUBLIC execute grant is the one that matters",
  );
  for (const role of ["anon", "authenticated", "service_role"]) {
    assert(
      revokes.some((statement) => statement.includes(role)),
      `${role} must not be able to execute the trigger`,
    );
  }

  assert(
    !all.some(
      (statement) =>
        statement.startsWith("grant") &&
        statement.includes("trigger_generate_horoscopes"),
    ),
    "nothing may grant EXECUTE back",
  );
});

Deno.test("the trigger runs with invoker rights and a pinned search_path", () => {
  assertStringIncludes(
    code,
    "security invoker",
    "invoker rights are the second gate: a non-postgres caller hits a permission error on the Vault view even if EXECUTE were re-granted",
  );
  assertStringIncludes(code, "set search_path = ''");
});

Deno.test("extensions are created without a schema and behind availability guards", () => {
  for (const extension of ["pg_cron", "pg_net"]) {
    assertStringIncludes(code, `create extension if not exists ${extension};`);
    assert(
      !code.includes(`create extension if not exists ${extension} with schema`),
      `${extension} is non-relocatable and creates its own schema, so "with schema" is wrong here`,
    );
    assertStringIncludes(
      code,
      `where name = '${extension}'`,
      `${extension} must be guarded on pg_available_extensions so a local Postgres without it warns rather than failing db reset`,
    );
  }
});

Deno.test("the scheduling block is dollar-quoted with a distinct tag", () => {
  // The command string is itself dollar-quoted, and dollar-quoting is lexical —
  // it knows nothing about comments. A bare `$$` outer block would be closed by
  // the first `$$` in the body, comment or not.
  assertStringIncludes(code, "do $do$");
  assertStringIncludes(
    code,
    "$cron$select public.trigger_generate_horoscopes();$cron$",
  );
});
