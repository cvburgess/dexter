import { assert, assertEquals } from "@std/assert";

import {
  resetSentryForTesting,
  type SentryClient,
  setSentryClientForTesting,
  withSentry,
} from "../../functions/_shared/sentry.ts";

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
