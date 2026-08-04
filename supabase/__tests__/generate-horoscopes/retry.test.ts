import { assert, assertEquals, assertRejects } from "@std/assert";

import {
  MAX_ATTEMPTS,
  withRetry,
} from "../../functions/generate-horoscopes/retry.ts";

// DEX-84. A real run lost two of twelve signs to transient failures, which is
// what this exists for. `sleep` is injected throughout so nothing here waits.

const noSleep = () => Promise.resolve();
const always = () => true;

/** An operation that fails `failures` times, then succeeds. */
function flaky(failures: number, error: unknown = new Error("boom")) {
  let calls = 0;
  return {
    calls: () => calls,
    run: () => {
      calls++;
      return calls <= failures ? Promise.reject(error) : Promise.resolve("ok");
    },
  };
}

Deno.test("a call that succeeds is made exactly once", async () => {
  const op = flaky(0);

  assertEquals(
    await withRetry(op.run, {
      label: "t",
      isRetryable: always,
      sleep: noSleep,
    }),
    "ok",
  );
  assertEquals(op.calls(), 1, "a successful call must not be repeated");
});

Deno.test("a transient failure is retried and can succeed", async () => {
  const op = flaky(1);

  assertEquals(
    await withRetry(op.run, {
      label: "t",
      isRetryable: always,
      sleep: noSleep,
    }),
    "ok",
  );
  assertEquals(op.calls(), 2);
});

Deno.test("retries stop at MAX_ATTEMPTS and rethrow the last error", async () => {
  // Rethrowing matters: the sign has to land in the caller's failure count
  // rather than being swallowed into a half-written batch.
  const op = flaky(Infinity, new Error("still down"));

  await assertRejects(
    () =>
      withRetry(op.run, { label: "t", isRetryable: always, sleep: noSleep }),
    Error,
    "still down",
  );
  assertEquals(op.calls(), MAX_ATTEMPTS, "must not retry forever");
});

Deno.test("a non-retryable failure is not retried at all", async () => {
  // The case that matters is a bad API key: retrying turns twelve wasted calls
  // into thirty-six and delays the error that says the key is wrong.
  const op = flaky(Infinity, new Error("401"));

  await assertRejects(() =>
    withRetry(op.run, { label: "t", isRetryable: () => false, sleep: noSleep })
  );
  assertEquals(op.calls(), 1);
});

Deno.test("backoff grows between attempts", async () => {
  const delays: number[] = [];
  const op = flaky(Infinity);

  await assertRejects(() =>
    withRetry(op.run, {
      label: "t",
      isRetryable: always,
      sleep: (ms) => {
        delays.push(ms);
        return Promise.resolve();
      },
    })
  );

  assertEquals(
    delays.length,
    MAX_ATTEMPTS - 1,
    "no sleep after the last attempt",
  );
  assert(delays[1] > delays[0], `expected growth, got ${delays.join(", ")}`);
});

Deno.test("a server's retry-after hint wins over the computed backoff", async () => {
  // Guessing a backoff against a rate limiter that already told us the answer
  // just burns another attempt.
  const delays: number[] = [];
  const rateLimited = Object.assign(new Error("slow down"), {
    retryAfterMs: 250,
  });
  const op = flaky(1, rateLimited);

  await withRetry(op.run, {
    label: "t",
    isRetryable: always,
    sleep: (ms) => {
      delays.push(ms);
      return Promise.resolve();
    },
  });

  assertEquals(delays, [250]);
});

Deno.test("an absurd retry-after hint is capped", async () => {
  // A server asking us to wait an hour would otherwise hold the whole run open
  // well past the pg_net timeout.
  const delays: number[] = [];
  const op = flaky(
    1,
    Object.assign(new Error("later"), { retryAfterMs: 3_600_000 }),
  );

  await withRetry(op.run, {
    label: "t",
    isRetryable: always,
    sleep: (ms) => {
      delays.push(ms);
      return Promise.resolve();
    },
  });

  assert(delays[0] <= 4000, `expected a capped delay, got ${delays[0]}`);
});
