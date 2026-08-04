import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";

import {
  fetchPrediction,
  parsePredictionDate,
  predictionResponseSchema,
  ZODIAC_SIGNS,
} from "../../functions/generate-horoscopes/astrology.ts";

// DEX-84. `index.ts` is a thin I/O shell by design, so the upstream contract —
// request shape, response validation, date format — is pinned here instead.
// Nothing in this file touches the network: `fetchPrediction` takes its fetch.
//
// The fixture below is the shape a live call actually returns (checked
// 2026-08-04), NOT the sample in the issue. Those differ: the issue's 2024
// sample carries a `<facet>_rating` integer per facet and the API no longer
// sends them. Writing fixtures from the spec rather than from a real response is
// what let that go unnoticed until the schema was already built around it — so
// re-check against a live call before changing this.

const prediction = {
  personal_life: "a",
  profession: "b",
  health: "c",
  emotions: "d",
  travel: "e",
  luck: "f",
};

const response = {
  status: true,
  sun_sign: "aries",
  prediction_date: "21-3-2024",
  prediction,
};

function stubFetch(body: unknown, init: { status?: number } = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl =
    ((url: string | URL | Request, requestInit?: RequestInit) => {
      calls.push({ url: String(url), init: requestInit });
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: init.status ?? 200 }),
      );
    }) as typeof fetch;
  return { fetch: fetchImpl, calls };
}

Deno.test("there are exactly twelve signs, in astrological order", () => {
  assertEquals(ZODIAC_SIGNS.length, 12);
  assertEquals(ZODIAC_SIGNS[0], "aries");
  assertEquals(ZODIAC_SIGNS[11], "pisces");
  assertEquals(
    new Set(ZODIAC_SIGNS).size,
    12,
    "a duplicate would silently drop a sign from the day's generation",
  );
});

Deno.test("prediction dates are converted from D-M-YYYY to ISO", () => {
  // The upstream zero-pads neither field, which is the whole reason this
  // function exists rather than a `new Date(...)` call.
  assertEquals(parsePredictionDate("21-3-2024"), "2024-03-21");
  assertEquals(parsePredictionDate("1-3-2024"), "2024-03-01");
  assertEquals(parsePredictionDate("01-12-2024"), "2024-12-01");
  assertEquals(parsePredictionDate(" 5-7-2026 "), "2026-07-05");
  assertEquals(
    parsePredictionDate("29-2-2024"),
    "2024-02-29",
    "a real leap day",
  );
});

Deno.test("an unusable prediction date throws rather than producing a wrong one", () => {
  // Silently coercing here would write a row under the wrong date, which is
  // worse than failing the sign: nobody would notice until the day arrived.
  for (
    const value of [
      "2024-03-21",
      "21/3/2024",
      "",
      "tomorrow",
      "21-13-2024",
      "32-3-2024",
      // A day that does not exist in that month. Passing it through would
      // produce `2024-02-31`, which Postgres rejects — failing the whole
      // twelve-row upsert rather than the one sign.
      "31-2-2024",
      "29-2-2023",
    ]
  ) {
    assertThrows(
      () => parsePredictionDate(value),
      Error,
      undefined,
      `"${value}" must be rejected`,
    );
  }
});

Deno.test("the request is a POST carrying the token header", async () => {
  const { fetch: fetchImpl, calls } = stubFetch(response);

  await fetchPrediction("aries", "secret-key", fetchImpl);

  assertEquals(calls.length, 1);
  assert(
    calls[0].url.endsWith("/sun_sign_prediction/daily/next/aries"),
    `unexpected URL: ${calls[0].url}`,
  );
  assertEquals(calls[0].init?.method, "POST");
  const headers = calls[0].init?.headers as Record<string, string>;
  assertEquals(headers["x-astrologyapi-key"], "secret-key");
});

Deno.test("the request pins the upstream's timezone to UTC", () => {
  // Load-bearing for the schedule, and -5.5 rather than 0 for a reason worth
  // pinning: the upstream applies `timezone` relative to IST, not UTC, so its
  // clock is 5.5 hours ahead. `timezone: 0` tests clean between 00:00 and 18:29
  // UTC — IST is the same calendar date then — and silently writes tomorrow's
  // rows under the day after outside that window, which makes `expected` never
  // fill and every later run re-fetch the same signs forever.
  const { fetch: fetchImpl, calls } = stubFetch(response);

  fetchPrediction("aries", "key", fetchImpl);

  assertEquals(JSON.parse(calls[0].init?.body as string), { timezone: -5.5 });
});

Deno.test("a non-2xx upstream response fails without echoing the body", async () => {
  const { fetch: fetchImpl } = stubFetch({ error: "invalid key sk-abc123" }, {
    status: 401,
  });

  const error = await assertRejects(
    () => fetchPrediction("leo", "bad-key", fetchImpl),
    Error,
  );
  assert(
    !error.message.includes("sk-abc123"),
    "the upstream echoes credentials in some error bodies, so the body must not reach the message that goes to Sentry",
  );
  assert(error.message.includes("401"));
});

Deno.test("a malformed prediction is rejected rather than partially stored", async () => {
  const { fetch: fetchImpl } = stubFetch({
    ...response,
    prediction: { ...prediction, luck: undefined },
  });

  await assertRejects(() => fetchPrediction("virgo", "key", fetchImpl));
});

Deno.test("a non-string facet is rejected", () => {
  // Every facet lands in a NOT NULL text column, so a non-string has to fail
  // here — one failed sign — rather than at the upsert, which would take the
  // whole batch with it.
  const result = predictionResponseSchema.safeParse({
    ...response,
    prediction: { ...prediction, luck: 7 },
  });

  assert(!result.success);
});

Deno.test("extra upstream fields are tolerated, not rejected", () => {
  // The upstream has already changed shape once under this feature (the 2024
  // sample's `<facet>_rating` fields are gone). A schema that rejected unknown
  // keys would turn a purely additive upstream change into twelve failed signs,
  // so the fields we need are required and anything else is ignored.
  const result = predictionResponseSchema.safeParse({
    ...response,
    prediction: { ...prediction, luck_rating: 7, some_new_facet: "x" },
  });

  assert(result.success);
});

Deno.test("a well-formed response parses", async () => {
  const { fetch: fetchImpl } = stubFetch(response);
  const parsed = await fetchPrediction("aries", "key", fetchImpl);

  assertEquals(parsed.prediction_date, "21-3-2024");
  assertEquals(parsed.prediction.luck, "f");
});
