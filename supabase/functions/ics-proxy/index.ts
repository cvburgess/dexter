// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";

import {
  buildOutboundHeaders,
  checkTargetSafety,
  type TargetError,
  validateIcsUrl,
} from "./validation.ts";
import { captureException, withSentry } from "../_shared/sentry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Abort the upstream fetch if it does not complete within this window.
const FETCH_TIMEOUT_MS = 10_000;

// Cap the proxied feed size. Calendar feeds are text and typically well under
// 1 MB; this bounds memory use and prevents the proxy being used to relay large
// payloads.
const MAX_BODY_BYTES = 5 * 1024 * 1024;

// Follow at most this many redirects, re-validating each hop.
const MAX_REDIRECTS = 5;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

// Fetches the target, following redirects manually so each hop is re-checked
// against the SSRF/scheme rules. Deno (unlike browsers) exposes the Location
// header on a `redirect: "manual"` response, which lets us validate the next
// hop before following it — closing the redirect-to-private-host bypass.
async function fetchSafely(
  initialUrl: URL,
  signal: AbortSignal,
): Promise<Response | TargetError> {
  let target = initialUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(target, {
      headers: buildOutboundHeaders(),
      redirect: "manual",
      signal,
    });

    const isRedirect = response.status >= 300 && response.status < 400;
    if (!isRedirect) return response;

    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location) {
      return { status: 502, error: "Upstream returned an invalid redirect" };
    }

    let next: URL;
    try {
      next = new URL(location, target);
    } catch {
      return { status: 502, error: "Upstream returned an invalid redirect" };
    }

    const unsafe = checkTargetSafety(next);
    if (unsafe) return unsafe;
    target = next;
  }

  return { status: 502, error: "Too many redirects" };
}

// Reads the response body as UTF-8 text, aborting if it exceeds maxBytes.
// Calendar feeds are always text, so decoding here is safe and lets us return a
// plain string. Returns null when the cap is exceeded.
async function readCappedBody(
  response: Response,
  maxBytes: number,
): Promise<string | null> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
}

Deno.serve(withSentry(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only support GET requests
  if (req.method !== "GET") {
    return jsonResponse({ error: "Only GET requests are supported" }, 405);
  }

  const rawUrl = new URL(req.url).searchParams.get("url");
  if (!rawUrl) {
    return jsonResponse({ error: "URL parameter is required" }, 400);
  }

  const validation = validateIcsUrl(rawUrl);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, validation.status);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const result = await fetchSafely(validation.url, controller.signal);
    if (!(result instanceof Response)) {
      return jsonResponse({ error: result.error }, result.status);
    }

    if (!result.ok) {
      await result.body?.cancel();
      return jsonResponse(
        { error: `Upstream request failed with status ${result.status}` },
        502,
      );
    }

    // Reject oversized feeds up front when the upstream advertises a size.
    const contentLength = Number(result.headers.get("Content-Length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      await result.body?.cancel();
      return jsonResponse({ error: "Calendar feed is too large" }, 413);
    }

    const body = await readCappedBody(result, MAX_BODY_BYTES);
    if (body === null) {
      return jsonResponse({ error: "Calendar feed is too large" }, 413);
    }

    // Return only the calendar payload with our own headers. Upstream response
    // headers (set-cookie, etc.) are intentionally not forwarded.
    return new Response(body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
      },
      status: 200,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return jsonResponse({ error: "Upstream request timed out" }, 504);
    }
    // Do not leak internal error details to the caller.
    captureException(error);
    return jsonResponse({ error: "Failed to fetch calendar feed" }, 502);
  } finally {
    clearTimeout(timeout);
  }
}));
