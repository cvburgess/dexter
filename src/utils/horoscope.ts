import { THoroscope, THoroscopeSentiment, TSunSign } from "@/api/horoscopes";
import { Constants } from "@/types/database.types";

// The Horoscope step's presentation tables (DEX-128, DEX-145): sign naming and
// glyphs, and how the twelve life areas are labeled, ordered, and grouped.

// Every glyph carries a trailing U+FE0E to force text presentation — bare
// U+2648–U+2653 render as full-color emoji on iOS/Android (docs/design.md).
export const SUN_SIGNS: Record<TSunSign, { label: string; glyph: string }> = {
  aries: { label: "Aries", glyph: "♈︎" },
  taurus: { label: "Taurus", glyph: "♉︎" },
  gemini: { label: "Gemini", glyph: "♊︎" },
  cancer: { label: "Cancer", glyph: "♋︎" },
  leo: { label: "Leo", glyph: "♌︎" },
  virgo: { label: "Virgo", glyph: "♍︎" },
  libra: { label: "Libra", glyph: "♎︎" },
  scorpio: { label: "Scorpio", glyph: "♏︎" },
  sagittarius: { label: "Sagittarius", glyph: "♐︎" },
  capricorn: { label: "Capricorn", glyph: "♑︎" },
  aquarius: { label: "Aquarius", glyph: "♒︎" },
  pisces: { label: "Pisces", glyph: "♓︎" },
};

// The sentinel PickerField uses for "no sign chosen" — it has no null to
// offer, so unset needs a real option to land on; the screen maps back to null.
export const NO_SUN_SIGN = "";

export type TSunSignOption = TSunSign | typeof NO_SUN_SIGN;

// Built from the generated enum array (declared in astrological order) rather
// than a second list that could fall out of step with it.
export const SUN_SIGN_OPTIONS: readonly {
  label: string;
  value: TSunSignOption;
}[] = [
  { label: "Not set", value: NO_SUN_SIGN },
  ...Constants.public.Enums.sun_sign.map((sign) => ({
    label: SUN_SIGNS[sign].label,
    value: sign,
  })),
];

// Narrowed from `keyof THoroscope` so a table entry can't point at `text`/
// `tips`/`sunSign` and get compared against a numeric threshold at runtime.
type THoroscopeRatingKey = Extract<keyof THoroscope, `rating${string}`>;

/** One of the twelve life areas the upstream rates. */
export type THoroscopeLifeArea = {
  /** The `THoroscope` field it reads — also the DB column, camelCased. */
  key: THoroscopeRatingKey;
  label: string;
};

// House order, not editorial — order only decides placement within a rating
// band. No icons: they'd compete with the three band marks.
export const LIFE_AREAS: readonly THoroscopeLifeArea[] = [
  { key: "ratingIdentity", label: "Identity" },
  { key: "ratingHealth", label: "Health" },
  { key: "ratingFinance", label: "Finance" },
  { key: "ratingCareer", label: "Career" },
  { key: "ratingLove", label: "Love" },
  { key: "ratingRelationships", label: "Relationships" },
  { key: "ratingCreativity", label: "Creativity" },
  { key: "ratingSpirituality", label: "Spirituality" },
  { key: "ratingHome", label: "Home" },
  { key: "ratingLearning", label: "Learning" },
  { key: "ratingCommunication", label: "Communication" },
  { key: "ratingTravel", label: "Travel" },
];

// The database counts these same buckets for `horoscopes.sentiment` (DEX-166)
// — change a threshold and the migration must change too.
export function ratingBucket(rating: number): THoroscopeSentiment {
  if (rating >= 4) return "positive";
  if (rating <= 2) return "negative";
  return "mixed";
}

/** One of the three bands the life areas are sorted into. */
export type THoroscopeRatingBucket = {
  id: THoroscopeSentiment;
  label: string;
  glyph: string;
};

// Best first, deliberately: worst-first read as an accusation under the day's
// advice. Arrows not faces — U+2639/U+263A/U+1F610 don't share a Unicode block.
export const RATING_BUCKETS: readonly THoroscopeRatingBucket[] = [
  { id: "positive", label: "Positive", glyph: "↑︎" },
  { id: "mixed", label: "Neutral", glyph: "→︎" },
  { id: "negative", label: "Negative", glyph: "↓︎" },
];

// A band can legitimately come back empty — nothing rating 1-2 is a good day,
// not a missing one — so the step still draws the row, marked with an em dash.
export function lifeAreasInBucket(
  horoscope: THoroscope,
  bucket: THoroscopeSentiment,
): readonly THoroscopeLifeArea[] {
  return LIFE_AREAS.filter(
    (area) => ratingBucket(horoscope[area.key]) === bucket,
  );
}

// One sentence per line for the hero summary; has the usual regex-splitter
// abbreviation problem ("e.g. this"), accepted for short prose.
export const bySentence = (prose: string): string =>
  prose.replace(/([.!?])[ \t]+(?=\S)/g, "$1\n");
