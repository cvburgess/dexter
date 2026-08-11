// astrology-api.io v3 client for DEX-145 (replacing AstrologyAPI, DEX-84).
//
// Everything in this module is pure or takes its `fetch` as an argument, so the
// whole upstream contract — the request shape, the response validation, and the
// life-area flattening — is testable without network access. Backend CI runs
// `deno test` with no network and no Postgres, so `index.ts` deliberately keeps
// nothing but I/O wiring.

import { z } from "zod";

import type { Database } from "@src/types/database.types.ts";

/** Mirrors the `public.sun_sign` enum, so the column type is the source of truth. */
export type TSunSign = Database["public"]["Enums"]["sun_sign"];

/**
 * The twelve sun signs, in astrological order.
 *
 * Lowercase because these strings are also the `sign` value the upstream
 * expects in the request body. `satisfies` makes a value the enum does not
 * contain a type error right here.
 */
export const ZODIAC_SIGNS = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
] as const satisfies readonly TSunSign[];

const API_URL = "https://api.astrology-api.io/api/v3/horoscope/sign/daily/text";

/**
 * The twelve life areas, in the order the upstream returns them (house order).
 *
 * Each maps to a `rating_<area>` column, so this list and the migration's
 * columns have to agree. Verified 2026-08-11 across four signs and two dates:
 * every response carried all twelve, always in this order.
 */
export const LIFE_AREAS = [
  "identity",
  "health",
  "finance",
  "career",
  "love",
  "relationships",
  "creativity",
  "spirituality",
  "home",
  "learning",
  "communication",
  "travel",
] as const;

export type TLifeArea = typeof LIFE_AREAS[number];

/**
 * A 1-5 rating, validated here rather than left to the column's CHECK.
 *
 * All twelve signs go up in a single upsert, so a value the constraint rejects
 * would fail the whole batch. Catching it in the parse fails just that sign,
 * which is what the per-sign isolation in `index.ts` is built to contain.
 */
const rating = z.number().int().min(1).max(5);

/**
 * Only the fields we store. Zod strips unknown keys by default, which is
 * deliberate: the payload also carries `sign_emoji`, `time_window`, `timeframe`,
 * `language`, `has_emoji`, `word_count`, and a `planetary_influences[]` array,
 * none of which the app uses. Declaring them would turn a provider adding or
 * renaming an unused field into twelve failed signs.
 */
export const horoscopeDataSchema = z.object({
  text: z.string().min(1),
  overall_rating: rating,
  tips: z.array(z.string()),
  life_area_focus: z.array(
    z.object({ area: z.string(), rating }),
  ),
  // Already ISO (`2026-08-11`) — unlike AstrologyAPI's `D-M-YYYY`, which needed
  // a parser and a round-trip to reject `31-2-2026`. Verified 2026-08-11.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be ISO YYYY-MM-DD"),
});

/**
 * The response envelope.
 *
 * The vendor's published sample shows only the inner object, but the wire format
 * wraps it: `{ success, data, metadata, warnings, pagination }`. Parsing the
 * envelope rather than the sample is the difference between reading `text` and
 * reading `undefined`.
 */
export const horoscopeResponseSchema = z.object({
  data: horoscopeDataSchema,
});

export type THoroscopeData = z.infer<typeof horoscopeDataSchema>;

/** The twelve ratings, keyed by area — the shape `row.ts` maps to columns. */
export type TLifeAreaRatings = Record<TLifeArea, number>;

/**
 * Flattens `life_area_focus[]` into a complete twelve-key record.
 *
 * Throws rather than defaulting a missing area. Every rating column is NOT
 * NULL, so a partial response has no sensible fallback — a zero would be
 * outside the CHECK, and inventing a 3 would quietly show the reader a neutral
 * face for an area the upstream never rated. Naming the missing areas is what
 * makes the Sentry report actionable if the payload ever changes shape.
 */
export function toLifeAreaRatings(
  focus: THoroscopeData["life_area_focus"],
): TLifeAreaRatings {
  const byArea = new Map(focus.map((entry) => [entry.area, entry.rating]));
  const missing = LIFE_AREAS.filter((area) => !byArea.has(area));

  if (missing.length > 0) {
    throw new Error(
      `life_area_focus is missing: ${missing.join(", ")}`,
    );
  }

  return Object.fromEntries(
    LIFE_AREAS.map((area) => [area, byArea.get(area)!]),
  ) as TLifeAreaRatings;
}

/**
 * Fetches one sign's horoscope for `date`.
 *
 * The date is requested explicitly rather than relying on an endpoint that
 * means "tomorrow". AstrologyAPI had a `/daily/next` path and a timezone offset
 * that had to be reverse-engineered against its server's clock; v3 takes an ISO
 * date and echoes it back, so "which day is this" stops being an inference.
 *
 * `fetchImpl` is injected rather than stubbed onto `globalThis` so tests never
 * touch the network — the same dependency-injection shape `_shared/sentry.ts`
 * uses for its client.
 */
export async function fetchHoroscope(
  sign: TSunSign,
  date: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<THoroscopeData> {
  const response = await fetchImpl(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sign,
      date,
      // ~35 words, which is what the step's hero is sized for.
      format: "short",
      // Observably inert: the vendor's docs disagree on whether this is
      // `use_emoji` or `emoji`, and neither name changed the output in testing
      // (2026-08-11) — `short` prose came back emoji-free either way, while the
      // response's own `has_emoji` reported `true` regardless. Sent because it
      // states the intent and costs nothing; do not "fix" it to `emoji` on the
      // assumption that it does something.
      use_emoji: false,
    }),
  });

  if (!response.ok) {
    // The body is not included: it can echo the request, and a quota-exhausted
    // 429 is the expected failure on a metered plan rather than a mystery
    // needing forensics.
    throw new Error(
      `astrology-api.io returned ${response.status} for ${sign}`,
    );
  }

  return horoscopeResponseSchema.parse(await response.json()).data;
}
