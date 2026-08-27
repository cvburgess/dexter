// Generates horoscopes for all twelve signs (DEX-84, DEX-145); contract and
// service-role rationale: docs/api-routes.md "generate-horoscopes".

import "@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@src/types/database.types.ts";

import { captureException, withSentry } from "../_shared/sentry.ts";
import { fetchHoroscope, type TSunSign, ZODIAC_SIGNS } from "./astrology.ts";
import { isAuthorizedCronRequest } from "./auth.ts";
import { toHoroscopeRow } from "./row.ts";

// No CORS/OPTIONS on purpose: pg_net is the only client, and naming
// `x-cron-secret` in an Allow-Headers list would advertise the gate.
function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

/** The date this run expects to produce: tomorrow, in UTC. */
function expectedDate(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return tomorrow.toISOString().slice(0, 10);
}

async function generateForSign(sign: TSunSign, date: string, apiKey: string) {
  try {
    return toHoroscopeRow(sign, await fetchHoroscope(sign, date, apiKey));
  } catch (error) {
    // `Promise.allSettled` keeps only the reason, and Zod errors don't name the
    // sign — Sentry is this job's durable signal, so the wrapper must say which.
    throw new Error(`Failed to generate the horoscope for ${sign}`, {
      cause: error,
    });
  }
}

async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const cronSecret = Deno.env.get("HOROSCOPE_CRON_SECRET");
  const astrologyApiKey = Deno.env.get("ASTROLOGY_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!cronSecret || !astrologyApiKey || !supabaseUrl || !serviceRoleKey) {
    // Never name the missing key in the response — this endpoint is publicly
    // reachable, and which secret is absent is itself information.
    captureException(new Error("generate-horoscopes is not configured"));
    return jsonResponse(
      { error: "Horoscope generation is not configured" },
      500,
    );
  }

  if (!isAuthorizedCronRequest(req, cronSecret)) {
    // Deliberately not reported to Sentry: the endpoint is public, so sprayed
    // rejections could DoS our own alerting. They belong in the request log.
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // Only `force` is read; a body is optional so a bare curl works.
  let force = false;
  try {
    const body = await req.json();
    force = body?.force === true;
  } catch {
    // No body, or not JSON. pg_net always sends one, but a manual smoke test
    // should not need to.
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Since DEX-145 the date is a request parameter (v3 takes an explicit ISO
  // date); the row's date still comes from the response — see the check below.
  const expected = expectedDate();

  // Quota guard: fetch only the signs missing for the date (`force` overrides).
  // Guards re-runs, not concurrent runs — those would read zero and duplicate.
  let alreadyStored = 0;
  let pending: readonly TSunSign[] = ZODIAC_SIGNS;
  if (!force) {
    const { data, error } = await supabase
      .from("horoscopes")
      .select("sun_sign")
      .eq("date", expected);

    if (error) {
      captureException(error);
      return jsonResponse({ error: "Failed to read existing horoscopes" }, 500);
    }

    const stored = new Set(data.map((row) => row.sun_sign));
    alreadyStored = stored.size;
    pending = ZODIAC_SIGNS.filter((sign) => !stored.has(sign));

    if (pending.length === 0) {
      // Every sign already stored. Same keys as the run below, so a consumer
      // never branches on `skipped` to read the result.
      return jsonResponse({
        expected,
        dates: [],
        generated: 0,
        failed: 0,
        complete: true,
        skipped: true,
      }, 200);
    }
  }

  // Per-sign isolation: one sign failing upstream must not cost the others.
  const results = await Promise.allSettled(
    pending.map((sign) => generateForSign(sign, expected, astrologyApiKey)),
  );

  const rows = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  const failures = results.filter((result) => result.status === "rejected");

  for (const failure of failures) {
    captureException(failure.reason);
    // Also logged: `captureException` no-ops with no SENTRY_DSN, and a local
    // run once lost two signs with no trace at all.
    console.error(failure.reason);
  }

  if (rows.length > 0) {
    // Upsert rather than insert: the natural key makes a re-run idempotent, and
    // `force` exists precisely to overwrite a bad generation.
    const { error } = await supabase
      .from("horoscopes")
      .upsert(rows, { onConflict: "sun_sign,date" });

    if (error) {
      captureException(error);
      return jsonResponse({ error: "Failed to store horoscopes" }, 500);
    }
  }

  // Dates actually written, not the date requested — a disagreement with
  // `expected` must be visible in `net._http_response`, not look like a run.
  const dates = [...new Set(rows.map((row) => row.date))].sort();

  // A row written under another date does nothing for the day this run is
  // completing — counting it would report `complete: true` while signs are missing.
  const storedForDate = alreadyStored +
    rows.filter((row) => row.date === expected).length;

  if (dates.some((date) => date !== expected)) {
    // Upstream stopped honoring `date`: every later run re-fetches the same
    // signs forever on metered calls — worth an alert, not a response field.
    captureException(
      new Error(
        `generate-horoscopes expected ${expected} but wrote ${
          dates.join(", ")
        }`,
      ),
    );
  }

  // The status describes the *day*, not this run's slice: 502 only when the
  // date has no rows at all — a one-sign miss is what the later runs repair.
  return jsonResponse({
    expected,
    dates,
    generated: rows.length,
    failed: failures.length,
    // "Is the day done?" — the question `net._http_response` is opened for.
    complete: storedForDate === ZODIAC_SIGNS.length,
  }, storedForDate > 0 ? 200 : 502);
}

Deno.serve(withSentry(handler));
