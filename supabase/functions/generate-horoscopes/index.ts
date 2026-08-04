// Generates tomorrow's horoscope for all twelve sun signs and upserts them into
// `public.horoscopes` (DEX-84).
//
// Invoked once a day by the pg_cron job in
// 20260804005119_schedule_generate_horoscopes.sql, which POSTs here through
// pg_net with the shared `x-cron-secret` header. See docs/backend.md
// "Scheduled jobs (pg_cron)".
//
// This is the first Edge Function to use the service role key. Every other
// function deliberately does not (docs/backend.md notes this for mcp-server):
// they act for a signed-in user, so a user-scoped client keeps RLS as the
// enforcement layer. Horoscopes are global rows that no user owns and no RLS
// policy grants INSERT on, so there is no user whose privileges could write
// them. The exposure is bounded by this file never reading a caller-supplied
// identifier and never returning row data.
//
// Like ics-proxy, everything worth testing lives in the sibling modules; this
// file is the I/O shell.

import "@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@src/types/database.types.ts";

import { captureException, withSentry } from "../_shared/sentry.ts";
import { fetchPrediction, type TSunSign, ZODIAC_SIGNS } from "./astrology.ts";
import { isAuthorizedCronRequest } from "./auth.ts";
import { toHoroscopeRow } from "./row.ts";
import { summarizePrediction } from "./summarize.ts";

// No CORS headers and no OPTIONS branch, unlike the other functions in this
// directory. Nothing browser-based ever calls this — pg_net is the only client —
// so the preflight machinery would be dead code, and naming `x-cron-secret` in
// an Allow-Headers list would advertise the gate for no benefit.
function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

/** The date this run expects to produce: tomorrow, in UTC. */
function expectedDate(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return tomorrow.toISOString().slice(0, 10);
}

async function generateForSign(sign: TSunSign, apiKey: string) {
  try {
    const response = await fetchPrediction(sign, apiKey);
    const summary = await summarizePrediction(response.prediction);
    return toHoroscopeRow(sign, response, summary);
  } catch (error) {
    // Twelve signs run concurrently and `Promise.allSettled` keeps only the
    // reason, so without this the sign is lost for every failure that does not
    // name it itself — "Summarization returned no object" and the Zod errors
    // are the common ones. Sentry is the durable signal for this job
    // (docs/backend.md "Scheduled jobs"), so it has to say which sign.
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
    // Not reported to Sentry, deliberately, and for the same reason
    // `verify-demo-otp` stays quiet on a bad code: this endpoint is publicly
    // reachable, so anyone spraying it could turn the error budget into a
    // denial-of-service against our own alerting. Rejections belong in the
    // request log.
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

  // The date this run *expects* to write. It is only a prediction: the row's
  // date comes from the upstream's own `prediction_date`, and the two can
  // disagree — keeping the cron inside 05:00–09:59 UTC is what makes that rare
  // rather than impossible. A disagreement costs a redundant regeneration (the
  // upsert absorbs it), never a wrong row, which is why the cheap guess is
  // preferred to fetching one sign first to find out.
  const expected = expectedDate();

  // The quota guard, and the work list: the signs already stored for the
  // expected date are the ones this run does not need to pay for again. A
  // partial run is an anticipated state (see the per-sign isolation below), and
  // asking *which* signs are missing rather than *how many* makes recovering
  // from one cost one upstream call and one generation instead of twelve of
  // each. `force` regenerates everything, which is what it is for.
  //
  // This does not guard against a second invocation arriving while the first is
  // still running — nothing is written until all signs settle, so a concurrent
  // retry would read zero and duplicate the work. It guards the far more likely
  // case: a re-run after the day is already done or partly done.
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
    pending = ZODIAC_SIGNS.filter((sign) => !stored.has(sign));

    if (pending.length === 0) {
      return jsonResponse(
        { expected, dates: [], generated: 0, failed: 0, skipped: true },
        200,
      );
    }
  }

  // Per-sign isolation: one sign failing upstream or in summarization must not
  // cost the others. Run concurrently — at most twelve short calls against two
  // services, well inside the wall-clock budget, and far enough under the AI
  // Gateway's rate cap that a concurrency bound would be premature.
  const results = await Promise.allSettled(
    pending.map((sign) => generateForSign(sign, astrologyApiKey)),
  );

  const rows = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  const failures = results.filter((result) => result.status === "rejected");

  for (const failure of failures) {
    captureException(failure.reason);
    // Logged as well as reported. `captureException` silently no-ops when
    // SENTRY_DSN is unset, which is every local run and any environment where
    // Sentry was never configured — a real local run lost two signs with no
    // trace at all before this was added. `supabase functions logs` is then the
    // second signal in production and the only one anywhere else.
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

  // Report the dates actually written rather than the guess above, so a
  // disagreement with `expected` is visible in `net._http_response` instead of
  // silently looking like a normal run. Normally one date; more than one means
  // the upstream is straddling a rollover and is worth a look.
  const dates = [...new Set(rows.map((row) => row.date))].sort();

  // 200 on partial success: the rows that landed are stored and the counts are
  // the honest answer, so reporting a total loss would only mislead. 502 when
  // every sign failed, which is the shape that means "upstream is down" and is
  // worth seeing as a failure. Sentry has the detail either way.
  return jsonResponse(
    { expected, dates, generated: rows.length, failed: failures.length },
    rows.length > 0 ? 200 : 502,
  );
}

Deno.serve(withSentry(handler));
