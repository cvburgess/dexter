// astrology-api.io v3 client (DEX-145, replacing AstrologyAPI DEX-84). Pure or
// fetch-injected throughout — CI has no network, so index.ts keeps the I/O.

import { z } from "zod";

import type { Database } from "@src/types/database.types.ts";

/** Mirrors the `public.sun_sign` enum, so the column type is the source of truth. */
export type TSunSign = Database["public"]["Enums"]["sun_sign"];

/**
 * Lowercase because these are also the upstream's `sign` request values;
 * `satisfies` makes a value outside the enum a type error here.
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
 * Each maps to a `rating_<area>` column, so this list and the migration's
 * columns have to agree (verified against live responses, 2026-08-11).
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
 * Validated here, not left to the column's CHECK: the twelve signs share one
 * upsert, so a constraint rejection fails the whole batch instead of one sign.
 */
const rating = z.number().int().min(1).max(5);

/**
 * Only the fields we store — declaring the payload's unused fields would turn a
 * provider renaming one into twelve failed signs.
 */
export const horoscopeDataSchema = z.object({
  text: z.string().min(1),
  overall_rating: rating,
  tips: z.array(z.string()),
  life_area_focus: z.array(
    z.object({ area: z.string(), rating }),
  ),
  // `2026-02-31` matches the pattern but fails the whole twelve-row upsert; JS
  // rolls impossible dates over, so only a round-trip-stable value is a real day.
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be ISO YYYY-MM-DD")
    .refine((value) => {
      const parsed = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value;
    }, "date must be a real calendar date"),
});

/**
 * The vendor's sample omits the envelope the wire format wraps everything in —
 * parsing it is the difference between reading `text` and reading `undefined`.
 */
export const horoscopeResponseSchema = z.object({
  data: horoscopeDataSchema,
});

export type THoroscopeData = z.infer<typeof horoscopeDataSchema>;

/** The twelve ratings, keyed by area — the shape `row.ts` maps to columns. */
export type TLifeAreaRatings = Record<TLifeArea, number>;

/**
 * Throws rather than defaulting a missing area — inventing a 3 would show a
 * neutral face for an area never rated; naming them keeps Sentry actionable.
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
 * The date is an explicit request parameter, never an inferred "tomorrow"
 * (AstrologyAPI's was IST-relative); `fetchImpl` injected so tests stay offline.
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
      // Observably inert either way (tested 2026-08-11): states intent only —
      // do not "fix" it to `emoji` on the assumption that it does something.
      use_emoji: false,
    }),
  });

  if (!response.ok) {
    // No body: it can echo the request, and a metered plan's 429 needs no
    // forensics.
    throw new Error(
      `astrology-api.io returned ${response.status} for ${sign}`,
    );
  }

  return horoscopeResponseSchema.parse(await response.json()).data;
}
