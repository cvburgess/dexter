import { assert, assertEquals } from "@std/assert";

import {
  captureException,
  initSentry,
  resetSentryForTesting,
  type SentryClient,
  setSentryClientForTesting,
  withSentry,
} from "../../functions/_shared/sentry.ts";
import { toolError } from "../../functions/mcp-server/tools/helpers.ts";

class FakeSentryClient implements SentryClient {
  readonly captured: unknown[] = [];
  flushCount = 0;

  init(_options: { dsn: string }): void {}

  captureException(error: unknown): string | undefined {
    this.captured.push(error);
    return "fake-event-id";
  }

  flush(_timeout?: number): Promise<boolean> {
    this.flushCount += 1;
    return Promise.resolve(true);
  }
}

Deno.test("captureException reports to the configured Sentry client", () => {
  const fake = new FakeSentryClient();
  setSentryClientForTesting(fake);

  try {
    const error = new Error("boom");
    captureException(error);

    assertEquals(fake.captured, [error]);
  } finally {
    resetSentryForTesting();
  }
});

Deno.test("captureException no-ops when Sentry has not been initialized", () => {
  resetSentryForTesting();

  // Should not throw even though no client (and no DSN) is configured.
  captureException(new Error("boom"));
});

Deno.test("initSentry no-ops gracefully when SENTRY_DSN is unset", async () => {
  resetSentryForTesting();
  const previousDsn = Deno.env.get("SENTRY_DSN");
  Deno.env.delete("SENTRY_DSN");

  try {
    await initSentry();

    // No client should have been configured, and reporting stays a silent
    // no-op — this never imports the real Sentry SDK, so it never needs
    // network access.
    captureException(new Error("boom"));
  } finally {
    if (previousDsn !== undefined) Deno.env.set("SENTRY_DSN", previousDsn);
    resetSentryForTesting();
  }
});

Deno.test("withSentry captures uncaught handler errors and sanitizes the response", async () => {
  const fake = new FakeSentryClient();
  setSentryClientForTesting(fake);

  try {
    const boom = new Error("unexpected failure with sensitive details");
    const handler = withSentry(() => {
      throw boom;
    });

    const response = await handler(new Request("http://localhost"));
    const body = await response.json();

    assertEquals(response.status, 500);
    assertEquals(body, { error: "Internal server error" });
    assert(!JSON.stringify(body).includes("sensitive details"));
    assertEquals(fake.captured, [boom]);
    assertEquals(fake.flushCount, 1);
  } finally {
    resetSentryForTesting();
  }
});

Deno.test("withSentry flushes buffered events before a successful response resolves", async () => {
  const fake = new FakeSentryClient();
  setSentryClientForTesting(fake);

  try {
    const handler = withSentry(() => Promise.resolve(new Response("ok")));
    await handler(new Request("http://localhost"));

    assertEquals(fake.flushCount, 1);
  } finally {
    resetSentryForTesting();
  }
});

Deno.test("withSentry does not interfere with successful responses", async () => {
  resetSentryForTesting();

  const handler = withSentry(() => Promise.resolve(new Response("ok")));
  const response = await handler(new Request("http://localhost"));

  assertEquals(await response.text(), "ok");
  resetSentryForTesting();
});

Deno.test("toolError reports the failure to Sentry", () => {
  const fake = new FakeSentryClient();
  setSentryClientForTesting(fake);

  try {
    const result = toolError("Task not found");

    assertEquals(result.isError, true);
    assertEquals(fake.captured.length, 1);
    assert(fake.captured[0] instanceof Error);
    assertEquals((fake.captured[0] as Error).message, "Task not found");
  } finally {
    resetSentryForTesting();
  }
});
