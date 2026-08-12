import { THoroscope, THoroscopeSentiment, TSunSign } from "@/api/horoscopes";
import { Constants } from "@/types/database.types";

/**
 * The Horoscope ritual step's presentation tables (DEX-128; re-shaped for
 * astrology-api.io v3 in DEX-145): how a sign is named and drawn, and how the
 * day's twelve life areas are labeled, ordered, and grouped.
 *
 * React-free so all of it is unit-testable without a native host, the same
 * split `ritualSteps.ts` uses.
 */

/**
 * Every sign's display name and glyph.
 *
 * A `Record` over `TSunSign` — which is the DB enum — so a sign added to the
 * type without an entry here is a compile error, the same guarantee
 * `STEP_ICONS` gives the ritual steps.
 *
 * The glyphs are the Unicode zodiac block (U+2648–U+2653) rather than an icon
 * or an asset. Neither SF Symbols nor Ionicons has a zodiac set, so an icon
 * would have meant twelve hand-authored SVGs and an asset pipeline the app
 * doesn't have; `docs/design.md` already treats an emoji standing in for an
 * icon as an icon, and these render on every platform with nothing bundled.
 *
 * **Every glyph carries a trailing `︎`**, and it is load-bearing rather
 * than decoration. U+2648–U+2653 have `Emoji_Presentation=Yes`, so bare code
 * points render as full-color emoji on iOS and Android — a sticker rather than
 * a mark, and one drawn in a palette no theme controls. U+FE0E is the
 * variation selector that forces *text* presentation, which is what makes the
 * hero glyph take `colors.text` like any other type. The escape is written out
 * per entry rather than appended in a helper because the selector is invisible
 * in source: spelled this way, the table shows exactly the string that renders.
 */
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

/**
 * The sentinel `PickerField` uses for "no sign chosen".
 *
 * `PickerField<V extends string>` has no null to offer, and its own comment
 * warns that a Picker whose value matches none of its items renders with
 * nothing selected — so an unset sign needs a real option to land on rather
 * than an absent one. The screen maps this back to `null` before it writes.
 */
export const NO_SUN_SIGN = "";

export type TSunSignOption = TSunSign | typeof NO_SUN_SIGN;

/**
 * The picker's options, in astrological order behind the unset sentinel.
 *
 * Built from `Constants.public.Enums.sun_sign` — the generated runtime array,
 * which the migration declares in astrological rather than alphabetical order
 * precisely so it can be read straight through — instead of a second list that
 * could fall out of step with the enum.
 */
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

/**
 * The rating fields of `THoroscope`, and nothing else.
 *
 * Narrowed from `keyof THoroscope` deliberately: that would also admit `text`,
 * `tips`, and `sunSign`, so a table entry pointing at one of them would compile
 * and then be compared against numeric thresholds at runtime. This makes the
 * mistake a type error and lets the lookup below drop its cast.
 */
type THoroscopeRatingKey = Extract<keyof THoroscope, `rating${string}`>;

/** One of the twelve life areas the upstream rates. */
export type THoroscopeLifeArea = {
  /** The `THoroscope` field it reads — also the DB column, camelCased. */
  key: THoroscopeRatingKey;
  label: string;
};

/**
 * The twelve life areas, in the upstream's order (which is house order).
 *
 * Deliberately *not* re-ordered editorially the way the old six facets were.
 * These are not read straight through — they are sorted into three bands by
 * their rating, so the list order only decides the order within a band, and
 * house order is the one arrangement an astrologer would recognize.
 *
 * `key` is typed against `THoroscope` so a renamed field breaks here rather
 * than rendering `undefined`. There are no icons: twelve glyphs competing with
 * three marks made the block read as a toolbar, and the label is already the
 * whole content — the step joins a band's labels into one string anyway.
 */
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

/**
 * Buckets a 1-5 life-area rating into the app's three-way sentiment vocabulary.
 *
 * **The same thresholds the database uses** to derive `horoscopes.sentiment`
 * from `overall_rating` (see the DEX-145 migration). Sharing the rule is the
 * point: the card's tint and these columns are the same judgement applied to
 * the whole day and to one area of it, so a reader seeing a green card over a
 * band of down arrows would be looking at a bug, not a nuance.
 *
 * Three even-ish groups out of five values means one of them takes the odd
 * width; the middle takes it, since a lone 3 is the genuinely neutral case and
 * splitting 1-2 / 3 / 4-5 keeps the two ends symmetric.
 */
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

/**
 * The three bands, **best first**.
 *
 * Worst-first was the first cut, on the reasoning that a reader scans for what
 * needs attention. It reads as an accusation: the first thing under the day's
 * advice was a list of what is going badly. Leading with what is going well
 * makes the same information land as a reading rather than a warning, and the
 * arrows still say which end is which without depending on the order.
 *
 * **Arrows rather than faces**, and the reason is consistency rather than
 * taste. The faces this started with could not come from one Unicode block:
 * U+2639 and U+263A carry the two ends, but there is no expressionless face
 * there at all — U+1F610 is the only one Unicode has, and it sits in the emoji
 * block, so the middle mark was drawn from a different font at a different
 * weight than its neighbours. U+2191/2192/2193 are one family, so the three
 * read as one set.
 *
 * **Every glyph still carries a trailing `︎`**, for the reason `SUN_SIGNS`
 * above spells out and `docs/design.md` states as a rule. These three default
 * to text presentation rather than depending on the selector the way U+1F610
 * did, so here it is belt-and-braces — but a bare arrow *can* be given an emoji
 * form by a following U+FE0F, and the app should never be one stray codepoint
 * away from a colored sticker in a palette no theme controls.
 */
export const RATING_BUCKETS: readonly THoroscopeRatingBucket[] = [
  { id: "positive", label: "Positive", glyph: "↑︎" },
  { id: "mixed", label: "Neutral", glyph: "→︎" },
  { id: "negative", label: "Negative", glyph: "↓︎" },
];

/**
 * The life areas that fall in one bucket, in house order.
 *
 * A band can legitimately come back empty — a day where nothing rates 1 or 2
 * is a good day, not a missing one — so the step draws its row regardless and
 * marks the absence with an em dash.
 */
export function lifeAreasInBucket(
  horoscope: THoroscope,
  bucket: THoroscopeSentiment,
): readonly THoroscopeLifeArea[] {
  return LIFE_AREAS.filter(
    (area) => ratingBucket(horoscope[area.key]) === bucket,
  );
}

/**
 * Sets prose one sentence to a line.
 *
 * Used on the hero summary, which is the one piece of text on the step that is
 * read rather than scanned: it sits alone in a screenful, centered, at
 * `heading`. Wrapped as a paragraph its line breaks fall wherever the measured
 * width puts them, which is nowhere in particular; a line per sentence makes
 * every break a real one and gives each clause its own beat. The facets below
 * deliberately do *not* use this — they are a list to run an eye down, and
 * ragged sentence-length lines would give six blocks six different shapes.
 *
 * Breaks on `?` and `!` as well as `.`, so a sentence that happens to end in a
 * question does not silently run into the next one. It has the abbreviation
 * problem every regex sentence splitter has — "e.g. this" would break — but
 * these strings are a generator's plain prose, and the alternative is a real
 * sentence tokenizer for one short line.
 *
 * Two details the tests pin. Whitespace is *replaced* rather than added to, so
 * prose that already wrapped its own lines cannot come back double-spaced. And
 * the lookahead requires something to actually follow — without it a string
 * ending in ". " turns its trailing space into a newline and hangs a blank line
 * under the last sentence.
 */
export const bySentence = (prose: string): string =>
  prose.replace(/([.!?])[ \t]+(?=\S)/g, "$1\n");
