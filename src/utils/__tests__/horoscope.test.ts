import { THoroscope } from "@/api/horoscopes";
import { Constants } from "@/types/database.types";
import {
  HOROSCOPE_FACETS,
  NO_SUN_SIGN,
  SUN_SIGN_OPTIONS,
  SUN_SIGNS,
} from "@/utils/horoscope";

// DEX-128: the Horoscope step's presentation tables.

const SIGNS = Constants.public.Enums.sun_sign;

describe("SUN_SIGNS", () => {
  it("names and draws every sign the enum declares", () => {
    for (const sign of SIGNS) {
      expect(SUN_SIGNS[sign].label).toBeTruthy();
      expect(SUN_SIGNS[sign].glyph).toBeTruthy();
    }

    expect(Object.keys(SUN_SIGNS)).toHaveLength(SIGNS.length);
  });

  it("gives each sign a distinct glyph", () => {
    const glyphs = SIGNS.map((sign) => SUN_SIGNS[sign].glyph);

    expect(new Set(glyphs).size).toBe(SIGNS.length);
  });
});

describe("SUN_SIGN_OPTIONS", () => {
  it("leads with the unset sentinel", () => {
    expect(SUN_SIGN_OPTIONS[0]).toEqual({
      label: "Not set",
      value: NO_SUN_SIGN,
    });
  });

  // Built from the generated enum array rather than a second hand-written list,
  // so the picker cannot fall out of step with the column it writes to — and it
  // reads in astrological order, which is why the migration declares it that
  // way rather than alphabetically.
  it("follows the enum's own order", () => {
    expect(SUN_SIGN_OPTIONS.slice(1).map((option) => option.value)).toEqual([
      ...SIGNS,
    ]);
  });

  it("labels each sign the way SUN_SIGNS does", () => {
    for (const option of SUN_SIGN_OPTIONS.slice(1)) {
      expect(option.label).toBe(
        SUN_SIGNS[option.value as (typeof SIGNS)[number]].label,
      );
    }
  });
});

describe("HOROSCOPE_FACETS", () => {
  // The six text columns the generator writes. `summary` and `sentiment` are
  // deliberately absent — they are the hero, not the detail below it.
  it("covers exactly the six facet fields", () => {
    const keys: (keyof THoroscope)[] = [
      "emotions",
      "personalLife",
      "profession",
      "health",
      "travel",
      "luck",
    ];

    expect([...HOROSCOPE_FACETS].map((facet) => facet.key).sort()).toEqual(
      [...keys].sort(),
    );
  });

  // Both names are required so neither platform silently falls back to a third
  // icon set (DEX-61) — the same guarantee `TIconName` gives at compile time,
  // asserted here because an empty string would satisfy the type.
  it("names both an SF Symbol and an Ionicon for every facet", () => {
    for (const facet of HOROSCOPE_FACETS) {
      expect(facet.icon.sf).toBeTruthy();
      expect(facet.icon.ionicon).toBeTruthy();
      expect(facet.label).toBeTruthy();
    }
  });
});
