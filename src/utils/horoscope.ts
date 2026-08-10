import { THoroscope, TSunSign } from "@/api/horoscopes";
import type { TIconName } from "@/components/Icon.types";
import { Constants } from "@/types/database.types";

/**
 * The Horoscope ritual step's presentation tables (DEX-128): how a sign is
 * named and drawn, and how the day's six facets are labeled and ordered.
 *
 * React-free so both are unit-testable without a native host, the same split
 * `ritualSteps.ts` uses.
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

/** One of the six facets the step scrolls to reveal. */
export type THoroscopeFacet = {
  /** The `THoroscope` field it reads — also the DB column, camelCased. */
  key: keyof THoroscope;
  label: string;
  icon: TIconName;
};

/**
 * The day's facets, in reading order.
 *
 * The order is editorial, not the column order: the two that shape a day
 * (emotions, personal life) lead, work and health follow, and the two
 * incidentals close. `key` is typed against `THoroscope` so a renamed field
 * breaks here rather than rendering `undefined`.
 *
 * **Pick each SF Symbol by how it renders, not by its name.** The suffix is not
 * a reliable guide to weight in this set: `face.smiling.fill` draws as an
 * outline here and the unsuffixed `face.smiling` draws solid, which is backwards
 * from the convention, and several unsuffixed symbols (`airplane`) are solid
 * with no outline variant at all. The six sit in one list and have to read as
 * one weight, so each was chosen against the others on a device.
 */
export const HOROSCOPE_FACETS: readonly THoroscopeFacet[] = [
  {
    key: "emotions",
    label: "Emotions",
    icon: { sf: "face.smiling.fill", ionicon: "happy-outline" },
  },
  {
    key: "personalLife",
    label: "Personal life",
    icon: { sf: "heart", ionicon: "heart-outline" },
  },
  {
    key: "profession",
    label: "Profession",
    icon: { sf: "briefcase", ionicon: "briefcase-outline" },
  },
  {
    key: "health",
    label: "Health",
    // Ionicons has no stethoscope, so the two halves are not the same drawing
    // here — `medical-outline` is that set's nearest instrument. Only Android
    // and web ever see it; iOS takes the SF Symbol.
    icon: { sf: "stethoscope", ionicon: "medical-outline" },
  },
  {
    key: "travel",
    label: "Travel",
    // A boat rather than a plane because SF draws `airplane` solid and
    // `sailboat` as an outline, and the row of six has to read as one weight.
    // The Ionicon follows the symbol so the two platforms show the same object.
    icon: { sf: "sailboat", ionicon: "boat-outline" },
  },
  {
    key: "luck",
    label: "Luck",
    icon: { sf: "die.face.5", ionicon: "dice-outline" },
  },
];

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
