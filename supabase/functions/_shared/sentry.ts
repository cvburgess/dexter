// Minimal Sentry (error monitoring) integration shared by the mcp-server and
// ics-proxy Edge Functions.
//
// There is no shared import map across functions today — each function
// resolves its own module graph (including this file) against its own
// `deno.json` (wired via `config.toml`). Both `functions/mcp-server/deno.json`
// and `functions/ics-proxy/deno.json` alias `@sentry/deno` to
// `npm:@sentry/deno`, so the bare specifier below resolves the same way
// regardless of which function loaded this module.
//
// Initialization is a graceful no-op when SENTRY_DSN is not configured: the
// Sentry SDK is not even imported in that case, so local dev and tests never
// need a DSN or network access.

export interface SentryClient {
  init(options: { dsn: string }): void;
  captureException(error: unknown): string | undefined;
}

let client: SentryClient | null = null;
let initPromise: Promise<void> | null = null;

async function loadSentryClient(): Promise<SentryClient> {
  const mod = await import("@sentry/deno");
  return mod as unknown as SentryClient;
}

async function doInitSentry(): Promise<void> {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return;

  // `client` is only assigned after the import and init both succeed, so
  // concurrent callers awaiting this same promise never observe a half-ready
  // client. If the SDK fails to load or init, Sentry stays disabled rather
  // than propagating the failure into the request path.
  try {
    const loaded = await loadSentryClient();
    loaded.init({ dsn });
    client = loaded;
  } catch (error) {
    console.error(
      "Sentry initialization failed; error reporting disabled",
      error,
    );
  }
}

/**
 * Initializes Sentry from the `SENTRY_DSN` env var. Safe to call multiple
 * times or concurrently; work runs once and all callers await the same
 * in-flight init, so none returns before the client is ready (or init has
 * failed). No-ops (and never imports the Sentry SDK) when `SENTRY_DSN` is
 * unset, and never rejects.
 */
export function initSentry(): Promise<void> {
  if (!initPromise) initPromise = doInitSentry();
  return initPromise;
}

/**
 * Reports an error to Sentry. No-ops if Sentry was never initialized (no
 * DSN configured, or `initSentry` has not run yet).
 */
export function captureException(error: unknown): void {
  client?.captureException(error);
}

/**
 * Wraps a `Deno.serve` handler so uncaught errors are reported to Sentry.
 * Catch blocks that already sanitize their own responses should call
 * `captureException` directly instead of relying on this wrapper; this is a
 * last-resort safety net that keeps the fallback response generic so no
 * internal error details leak to the client.
 */
export function withSentry(
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    await initSentry();
    try {
      return await handler(req);
    } catch (error) {
      captureException(error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  };
}

/** Test-only: inject a fake Sentry client, bypassing the real SDK import. */
export function setSentryClientForTesting(fake: SentryClient | null): void {
  client = fake;
  initPromise = Promise.resolve();
}

/** Test-only: reset module state between tests. */
export function resetSentryForTesting(): void {
  client = null;
  initPromise = null;
}
