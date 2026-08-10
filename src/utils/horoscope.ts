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
 * Note these code points default to *emoji* presentation, so iOS and Android
 * draw them in color rather than as monochrome type. That is intended — the
 * step uses one as a hero mark. Appending U+FE0E would force the text form.
 */
export const SUN_SIGNS: Record<TSunSign, { label: string; glyph: string }> = {
  aries: { label: "Aries", glyph: "♈" },
  taurus: { label: "Taurus", glyph: "♉" },
  gemini: { label: "Gemini", glyph: "♊" },
  cancer: { label: "Cancer", glyph: "♋" },
  leo: { label: "Leo", glyph: "♌" },
  virgo: { label: "Virgo", glyph: "♍" },
  libra: { label: "Libra", glyph: "♎" },
  scorpio: { label: "Scorpio", glyph: "♏" },
  sagittarius: { label: "Sagittarius", glyph: "♐" },
  capricorn: { label: "Capricorn", glyph: "♑" },
  aquarius: { label: "Aquarius", glyph: "♒" },
  pisces: { label: "Pisces", glyph: "♓" },
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
 */
export const HOROSCOPE_FACETS: readonly THoroscopeFacet[] = [
  {
    key: "emotions",
    label: "Emotions",
    icon: { sf: "face.smiling", ionicon: "happy-outline" },
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
    icon: { sf: "figure.walk", ionicon: "fitness-outline" },
  },
  {
    key: "travel",
    label: "Travel",
    icon: { sf: "airplane", ionicon: "airplane-outline" },
  },
  {
    key: "luck",
    label: "Luck",
    icon: { sf: "die.face.5", ionicon: "dice-outline" },
  },
];
