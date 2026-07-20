// Signs the App Store reviewer / marketing demo account in without an inbox.
//
// The app's normal login is passwordless (magic link + email OTP), so a
// reviewer can't receive a code out of band. Instead they enter the demo email
// and a fixed code (DEMO_OTP); this function verifies both and exchanges them
// for a real session via password sign-in. The demo password is *derived* from
// the same DEMO_OTP the `seed-demo` script used to set it (see
// `../_shared/demoAuth.ts`), so no password is stored here or shipped in the
// app. Only the demo account can be signed in this way, and only with the
// correct code.
//
// This uses the publishable key (not the service role) — `signInWithPassword`
// is a normal auth call — so it does not widen the backend's privileges.

import "@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "@supabase/supabase-js";

import { captureException, withSentry } from "../_shared/sentry.ts";
import { deriveDemoPassword, isDemoEmail } from "../_shared/demoAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const demoOtp = Deno.env.get("DEMO_OTP");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (!demoOtp || !supabaseUrl || !publishableKeys) {
    captureException(new Error("verify-demo-otp is not configured"));
    return jsonResponse({ error: "Demo login is not configured" }, 500);
  }

  let email = "";
  let token = "";
  try {
    const body = await req.json();
    email = typeof body?.email === "string" ? body.email : "";
    token = typeof body?.token === "string" ? body.token : "";
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  // One constant rejection for every bad input, so the endpoint can't be used
  // to probe which emails exist or how close a guessed code is.
  if (!isDemoEmail(email) || token !== demoOtp) {
    return jsonResponse({ error: "Invalid code" }, 401);
  }

  // Supabase injects the publishable keys as a JSON dictionary keyed by name;
  // the baseline ships a single key named "default" (mirrors mcp-server/auth).
  const supabasePublishableKey = JSON.parse(publishableKeys)["default"];
  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: deriveDemoPassword(demoOtp),
  });
  if (error || !data.session) {
    // The demo user or its password is missing: `seed-demo` has not run, or
    // DEMO_OTP changed since it did. Distinct from a bad code above.
    captureException(error ?? new Error("Demo sign-in returned no session"));
    return jsonResponse({ error: "Demo account is not ready" }, 500);
  }

  return jsonResponse({ session: data.session }, 200);
}

Deno.serve(withSentry(handler));
