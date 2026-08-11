import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";

import {
  fetchHoroscope,
  horoscopeResponseSchema,
  LIFE_AREAS,
  toLifeAreaRatings,
  ZODIAC_SIGNS,
} from "../../functions/generate-horoscopes/astrology.ts";

// DEX-145. `index.ts` is a thin I/O shell by design, so the upstream contract —
// request shape, response validation, life-area flattening — is pinned here
// instead. Nothing in this file touches the network: `fetchHoroscope` takes its
// fetch.
//
// The fixture below is the shape a live call actually returns (checked
// 2026-08-11 against four signs and two dates), NOT the vendor's published
// sample. Those differ in the way that matters most: the sample shows only the
// inner object, while the wire format wraps it in
// `{ success, data, metadata, ... }`. A fixture written from the docs would have
// made every assertion here pass against a parser that reads `undefined` in
// production. Re-check against a live call before changing this.

const data = {
  text: "The universe offers subtle guidance through synchronicities.",
  format: "short",
  word_count: 35,
  sign: "Aries",
  sign_emoji: "♈",
  timeframe: "daily",
  overall_rating: 4,
  time_window: {
    start: "2026-08-12",
    end: "2026-08-12",
    timeframe: "daily",
    days: 1,
  },
  tips: ["Focus on progress.", "Take practical steps.", "Stay open."],
  life_area_focus: LIFE_AREAS.map((area, index) => ({
    // A distinct value per area, cycling 1-5, so a mapping that crosses two
    // areas produces a different number rather than coincidentally the same one.
    area,
    rating: (index % 5) + 1,
  })),
  planetary_influences: [{ planet: "Chiron", exact_time: null }],
  date: "2026-08-12",
  language: "en",
  has_emoji: true,
};

const envelope = { success: true, data, metadata: { credits_used: 1 } };

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

Deno.test("there are exactly twelve life areas, each distinct", () => {
  // Each one is a NOT NULL `rating_<area>` column. A duplicate here would leave
  // one column unwritten and fail the insert for every sign at once.
  assertEquals(LIFE_AREAS.length, 12);
  assertEquals(new Set(LIFE_AREAS).size, 12);
});

Deno.test("the request is a POST carrying a bearer token", async () => {
  const { fetch: fetchImpl, calls } = stubFetch(envelope);

  await fetchHoroscope("aries", "2026-08-12", "secret-key", fetchImpl);

  assertEquals(calls.length, 1);
  assertEquals(calls[0].init?.method, "POST");
  const headers = calls[0].init?.headers as Record<string, string>;
  assertEquals(
    headers.Authorization,
    "Bearer secret-key",
    "v3 is bearer-authenticated; the old provider used an x-astrologyapi-key header",
  );
});

Deno.test("the request asks for a specific date in short format", async () => {
  // The date is load-bearing: the cron generates *tomorrow* so the reading is
  // ready when the reader wakes. Under the old provider this was an endpoint
  // meaning "next" plus a timezone offset reverse-engineered against a server
  // clock in IST; here it is a parameter, and this pins that it is actually sent.
  const { fetch: fetchImpl, calls } = stubFetch(envelope);

  await fetchHoroscope("scorpio", "2026-08-12", "key", fetchImpl);

  assertEquals(JSON.parse(calls[0].init?.body as string), {
    sign: "scorpio",
    date: "2026-08-12",
    format: "short",
    use_emoji: false,
  });
});

Deno.test("a non-2xx upstream response fails without echoing the body", async () => {
  // 429 is the expected failure on a metered plan, and the body can echo the
  // request. Neither belongs in the message that reaches Sentry.
  const { fetch: fetchImpl } = stubFetch(
    { error: "quota exceeded key sk-abc" },
    {
      status: 429,
    },
  );

  const error = await assertRejects(
    () => fetchHoroscope("leo", "2026-08-12", "bad-key", fetchImpl),
    Error,
  );
  assert(!error.message.includes("sk-abc"), "the body must not reach Sentry");
  assert(error.message.includes("429"));
  assert(error.message.includes("leo"), "the message has to name the sign");
});

Deno.test("the response envelope is unwrapped", async () => {
  // The regression this exists for: the vendor's docs show the inner object, so
  // a schema written from them parses `{ text, ... }` and silently reads
  // `undefined` against the real `{ success, data: { text, ... } }`.
  const { fetch: fetchImpl } = stubFetch(envelope);

  const parsed = await fetchHoroscope("aries", "2026-08-12", "key", fetchImpl);

  assertEquals(parsed.text, data.text);
  assertEquals(parsed.date, "2026-08-12");
  assertEquals(parsed.overall_rating, 4);
});

Deno.test("an unwrapped body is rejected rather than read as undefined", () => {
  assert(!horoscopeResponseSchema.safeParse(data).success);
});

Deno.test("extra upstream fields are tolerated, not rejected", () => {
  // The fixture already carries `planetary_influences`, `sign_emoji`,
  // `time_window`, `language`, and `word_count`, none of which are stored. A
  // schema that rejected unknown keys would turn a purely additive upstream
  // change into twelve failed signs.
  const result = horoscopeResponseSchema.safeParse({
    ...envelope,
    data: { ...data, brand_new_field: "x" },
  });

  assert(result.success);
});

Deno.test("a rating outside 1-5 is rejected", () => {
  // Every rating lands in a column with a CHECK, and all twelve rows go up in
  // one upsert — so an out-of-range value has to fail here, costing one sign,
  // rather than at the insert, which would take the whole batch.
  for (const overall_rating of [0, 6, 2.5, -1]) {
    assert(
      !horoscopeResponseSchema.safeParse({
        ...envelope,
        data: { ...data, overall_rating },
      }).success,
      `${overall_rating} must be rejected`,
    );
  }
});

Deno.test("a non-ISO date is rejected", () => {
  // The column is a `date`, and a value Postgres cannot parse fails all twelve
  // rows rather than the one sign.
  for (const date of ["12-8-2026", "2026/08/12", "tomorrow", ""]) {
    assert(
      !horoscopeResponseSchema.safeParse({
        ...envelope,
        data: { ...data, date },
      })
        .success,
      `"${date}" must be rejected`,
    );
  }
});

Deno.test("a well-formed but impossible date is rejected", () => {
  // The shape check alone passes every one of these, and every one is a value
  // Postgres refuses — which fails the whole twelve-row upsert, not just the
  // sign that carried it. The predecessor had this guard for `31-2-2026`;
  // moving to an ISO format did not remove the need for it.
  for (const date of ["2026-02-31", "2026-13-01", "2026-00-10", "2026-04-31"]) {
    assert(
      !horoscopeResponseSchema.safeParse({
        ...envelope,
        data: { ...data, date },
      })
        .success,
      `"${date}" is not a real day and must be rejected`,
    );
  }
});

Deno.test("a leap day is accepted", () => {
  // The round-trip must not be so strict that it rejects real days.
  assert(
    horoscopeResponseSchema.safeParse({
      ...envelope,
      data: { ...data, date: "2028-02-29" },
    }).success,
  );
});

Deno.test("life areas flatten to a complete twelve-key record", () => {
  const ratings = toLifeAreaRatings(data.life_area_focus);

  assertEquals(Object.keys(ratings).length, 12);
  // Spot-check that each area kept its own number rather than a neighbour's.
  assertEquals(ratings.identity, 1);
  assertEquals(ratings.health, 2);
  assertEquals(ratings.travel, (LIFE_AREAS.indexOf("travel") % 5) + 1);
});

Deno.test("a missing life area throws and names what is missing", () => {
  // Every rating column is NOT NULL, so there is no sensible default: a zero is
  // outside the CHECK and an invented 3 would show the reader a neutral face for
  // an area the upstream never rated.
  const error = assertThrows(
    () =>
      toLifeAreaRatings(
        data.life_area_focus.filter((entry) =>
          entry.area !== "career" && entry.area !== "home"
        ),
      ),
    Error,
  );

  assert(error.message.includes("career"), error.message);
  assert(error.message.includes("home"), error.message);
});

Deno.test("an unknown life area is ignored rather than carried through", () => {
  // A thirteenth area from the upstream has no column to land in, so it must not
  // reach the insert — the same additive-change tolerance the schema has.
  const ratings = toLifeAreaRatings([
    ...data.life_area_focus,
    { area: "astral_projection", rating: 5 },
  ]);

  assertEquals(Object.keys(ratings).length, 12);
  assert(!("astral_projection" in ratings));
});
