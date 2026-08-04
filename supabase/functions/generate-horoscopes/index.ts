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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

/** The date this run expects to produce: tomorrow, in UTC. */
function expectedDate(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return tomorrow.toISOString().slice(0, 10);
}

async function generateForSign(sign: TSunSign, apiKey: string) {
  const response = await fetchPrediction(sign, apiKey);
  const summary = await summarizePrediction(response.prediction);
  return toHoroscopeRow(sign, response, summary);
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
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
    // Reported so that probing shows up in triage rather than only in the
    // request log.
    captureException(
      new Error("generate-horoscopes rejected an unauthorized request"),
    );
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

  const date = expectedDate();

  // The real quota guard. pg_net's timeout does not cancel this function, so a
  // timed-out request can be retried while the first run is still working or
  // has already succeeded; without this, a retry — or a leaked secret — spends
  // upstream and LLM budget again.
  if (!force) {
    const { count, error } = await supabase
      .from("horoscopes")
      .select("sun_sign", { count: "exact", head: true })
      .eq("date", date);

    if (error) {
      captureException(error);
      return jsonResponse({ error: "Failed to read existing horoscopes" }, 500);
    }
    if ((count ?? 0) >= ZODIAC_SIGNS.length) {
      return jsonResponse(
        { date, generated: 0, failed: 0, skipped: true },
        200,
      );
    }
  }

  // Per-sign isolation: one sign failing upstream or in summarization must not
  // cost the other eleven. Run concurrently — twelve short calls against two
  // services, well inside the wall-clock budget.
  const results = await Promise.allSettled(
    ZODIAC_SIGNS.map((sign) => generateForSign(sign, astrologyApiKey)),
  );

  const rows = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  const failures = results.filter((result) => result.status === "rejected");

  for (const failure of failures) {
    captureException(failure.reason);
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

  // 200 on partial success: the rows that landed are stored and the counts are
  // the honest answer, so reporting a total loss in `net._http_response` would
  // only mislead. 502 when every sign failed, which is the shape that means
  // "upstream is down" and is worth seeing as a failure. Sentry has the detail
  // either way.
  return jsonResponse(
    { date, generated: rows.length, failed: failures.length },
    rows.length > 0 ? 200 : 502,
  );
}

Deno.serve(withSentry(handler));
