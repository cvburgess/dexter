// Retry for the two outbound API calls in DEX-84.
//
// A real run lost two of twelve signs to transient failures. Each sign is one
// shot at a third-party API and one at an LLM gateway, and the job runs once a
// day, so a blip meant a missing horoscope until someone noticed. Retrying is
// far cheaper than the second cron job the alternative would need.
//
// Deliberately narrow: only failures that could plausibly succeed on a second
// attempt are retried. A 401 from a bad key will never fix itself, and retrying
// it turns twelve wasted calls into thirty-six while delaying the 502 that tells
// you the key is wrong.

/** Total attempts, including the first. Three covers a blip without stalling. */
export const MAX_ATTEMPTS = 3;

const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 4000;

/** An error carrying a server-supplied hint about when to try again. */
export interface RetryAfter {
  retryAfterMs?: number;
}

function delayFor(attempt: number, error: unknown): number {
  // Honor the server's own hint when it gives one — guessing a backoff against
  // a rate limiter that already told us the answer just burns another attempt.
  const hint = (error as RetryAfter)?.retryAfterMs;
  if (typeof hint === "number" && hint > 0) return Math.min(hint, MAX_DELAY_MS);

  const backoff = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
  // Jitter so twelve signs failing together don't retry in lockstep and
  // reproduce the burst that rate-limited them.
  return backoff + Math.random() * backoff * 0.25;
}

export interface RetryOptions {
  /** What this is retrying, for the log line. */
  label: string;
  /** Whether a given failure could plausibly succeed on another attempt. */
  isRetryable: (error: unknown) => boolean;
  attempts?: number;
  /** Injected so tests do not actually wait. */
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `operation`, retrying transient failures with jittered backoff.
 *
 * Rethrows the last error once attempts are exhausted, so the caller's failure
 * handling is unchanged — a sign that cannot be generated still lands in the
 * failure count rather than being silently dropped.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  { label, isRetryable, attempts = MAX_ATTEMPTS, sleep = realSleep }:
    RetryOptions,
): Promise<T> {
  for (let attempt = 1;; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= attempts || !isRetryable(error)) throw error;

      const delay = delayFor(attempt, error);
      // Warn rather than capture: this attempt failed but the operation has not.
      // Reporting it to Sentry would make a recovered blip look like an incident.
      console.warn(
        `${label}: attempt ${attempt} of ${attempts} failed, retrying in ${
          Math.round(delay)
        }ms`,
        error,
      );
      await sleep(delay);
    }
  }
}
