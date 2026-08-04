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

const prediction = {
  personal_life: "a",
  profession: "b",
  health: "c",
  emotions: "d",
  travel: "e",
  luck: "f",
  personal_life_rating: 6,
  profession_rating: 7,
  health_rating: 5,
  emotions_rating: 6,
  travel_rating: 8,
  luck_rating: 7,
};

const response = {
  status: true,
  sun_sign: "aries",
  prediction_date: "21-3-2024",
  prediction,
};

function stubFetch(
  body: unknown,
  init: { status?: number } = {},
): { fetch: typeof fetch; calls: { url: string; init?: RequestInit }[] } {
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

Deno.test("the request is a POST carrying the token header", () => {
  const { fetch: fetchImpl, calls } = stubFetch(response);

  return fetchPrediction("aries", "secret-key", fetchImpl).then(() => {
    assertEquals(calls.length, 1);
    assert(
      calls[0].url.endsWith("/sun_sign_prediction/daily/next/aries"),
      `unexpected URL: ${calls[0].url}`,
    );
    assertEquals(calls[0].init?.method, "POST");
    const headers = calls[0].init?.headers as Record<string, string>;
    assertEquals(headers["x-astrologyapi-key"], "secret-key");
  });
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

Deno.test("out-of-range ratings are rejected before they reach the check constraint", () => {
  // The column bound is 0..10. Catching it here turns a constraint violation
  // that would abort the whole upsert into one failed sign.
  const result = predictionResponseSchema.safeParse({
    ...response,
    prediction: { ...prediction, luck_rating: 47 },
  });
  assert(!result.success);

  const fractional = predictionResponseSchema.safeParse({
    ...response,
    prediction: { ...prediction, luck_rating: 7.5 },
  });
  assert(!fractional.success, "smallint cannot hold a fraction");
});

Deno.test("a well-formed response parses", async () => {
  const { fetch: fetchImpl } = stubFetch(response);
  const parsed = await fetchPrediction("aries", "key", fetchImpl);

  assertEquals(parsed.prediction_date, "21-3-2024");
  assertEquals(parsed.prediction.luck_rating, 7);
});
