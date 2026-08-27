// Each importing function must alias `@sentry/deno` in its own deno.json —
// there is no shared import map. A missing SENTRY_DSN skips the import entirely.

export interface SentryClient {
  init(options: { dsn: string }): void;
  captureException(error: unknown): string | undefined;
  flush(timeout?: number): Promise<boolean>;
}

// Isolates can be torn down right after the response, so buffered events must
// flush before the handler resolves or they never reach Sentry.
const FLUSH_TIMEOUT_MS = 2000;

let client: SentryClient | null = null;
let initPromise: Promise<void> | null = null;

async function loadSentryClient(): Promise<SentryClient> {
  const mod = await import("@sentry/deno");
  return mod as unknown as SentryClient;
}

async function doInitSentry(): Promise<void> {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return;

  // `client` is assigned only after import and init both succeed; a failure
  // leaves Sentry disabled rather than propagating into the request path.
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
 * Idempotent and concurrency-safe: all callers await one in-flight init.
 * Never rejects; never imports the SDK when `SENTRY_DSN` is unset.
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
 * Call before the handler resolves so events survive isolate shutdown.
 * No-ops uninitialized; never rejects.
 */
export async function flushSentry(): Promise<void> {
  if (!client) return;
  try {
    await client.flush(FLUSH_TIMEOUT_MS);
  } catch (error) {
    console.error("Sentry flush failed", error);
  }
}

/**
 * Last-resort net: the fallback response stays generic so no internal detail
 * leaks. Sanitizing catch blocks should call `captureException` themselves.
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
    } finally {
      // Covers every capture in the request — wrapper catch, sanitized
      // catches, `toolError` — all of which run before this finally.
      await flushSentry();
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
