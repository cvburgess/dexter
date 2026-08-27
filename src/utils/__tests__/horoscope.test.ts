import { THoroscope } from "@/api/horoscopes";
import { Constants } from "@/types/database.types";
import {
  bySentence,
  LIFE_AREAS,
  lifeAreasInBucket,
  NO_SUN_SIGN,
  RATING_BUCKETS,
  ratingBucket,
  SUN_SIGN_OPTIONS,
  SUN_SIGNS,
} from "@/utils/horoscope";

// DEX-128, re-shaped in DEX-145: the Horoscope step's presentation tables.

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

  // Built from the generated enum array, not a second hand-written list, so
  // the picker can't fall out of step with the column it writes to.
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

describe("LIFE_AREAS", () => {
  it("covers exactly the twelve rating columns", () => {
    const keys: (keyof THoroscope)[] = [
      "ratingIdentity",
      "ratingHealth",
      "ratingFinance",
      "ratingCareer",
      "ratingLove",
      "ratingRelationships",
      "ratingCreativity",
      "ratingSpirituality",
      "ratingHome",
      "ratingLearning",
      "ratingCommunication",
      "ratingTravel",
    ];

    expect([...LIFE_AREAS].map((area) => area.key).sort()).toEqual(
      [...keys].sort(),
    );
  });

  it("labels every area", () => {
    for (const area of LIFE_AREAS) expect(area.label).toBeTruthy();
  });
});

describe("ratingBucket", () => {
  // DEX-166: these thresholds are also the database's generated-column rule,
  // which no test here reaches — this pins the side that can regress.
  it("splits 1-5 into three groups, worst to best", () => {
    expect(ratingBucket(1)).toBe("negative");
    expect(ratingBucket(2)).toBe("negative");
    expect(ratingBucket(3)).toBe("mixed");
    expect(ratingBucket(4)).toBe("positive");
    expect(ratingBucket(5)).toBe("positive");
  });
});

describe("RATING_BUCKETS", () => {
  // Best first, deliberately — worst-first read as an accusation under the
  // day's advice; the arrows carry the meaning either way.
  it("leads with the positive band", () => {
    expect(RATING_BUCKETS.map((bucket) => bucket.id)).toEqual([
      "positive",
      "mixed",
      "negative",
    ]);
  });

  it("gives each bucket a distinct label and glyph", () => {
    expect(new Set(RATING_BUCKETS.map((b) => b.glyph)).size).toBe(3);
    expect(new Set(RATING_BUCKETS.map((b) => b.label)).size).toBe(3);
  });

  // The variation selector forces text presentation instead of a full-color
  // emoji; invisible in source, so only a test notices it going missing.
  it("forces text presentation on every glyph", () => {
    for (const bucket of RATING_BUCKETS) {
      expect(bucket.glyph).toContain("︎");
    }
  });
});

describe("lifeAreasInBucket", () => {
  const horoscope = {
    ratingIdentity: 1,
    ratingHealth: 3,
    ratingFinance: 5,
    ratingCareer: 2,
    ratingLove: 3,
    ratingRelationships: 4,
    ratingCreativity: 3,
    ratingSpirituality: 3,
    ratingHome: 3,
    ratingLearning: 3,
    ratingCommunication: 3,
    ratingTravel: 3,
  } as THoroscope;

  it("sorts each area into exactly one band", () => {
    const total = RATING_BUCKETS.reduce(
      (sum, bucket) => sum + lifeAreasInBucket(horoscope, bucket.id).length,
      0,
    );

    expect(total).toBe(LIFE_AREAS.length);
  });

  it("groups by the area's own rating", () => {
    expect(
      lifeAreasInBucket(horoscope, "negative").map((a) => a.label),
    ).toEqual(["Identity", "Career"]);
    expect(
      lifeAreasInBucket(horoscope, "positive").map((a) => a.label),
    ).toEqual(["Finance", "Relationships"]);
  });

  // A day where nothing rates 1 or 2 is a good day, not a broken one — the step
  // still draws the band's row and marks it with an em dash.
  it("returns an empty list rather than throwing when a band has nothing", () => {
    const allNeutral = Object.fromEntries(
      LIFE_AREAS.map((area) => [area.key, 3]),
    ) as unknown as THoroscope;

    expect(lifeAreasInBucket(allNeutral, "negative")).toEqual([]);
    expect(lifeAreasInBucket(allNeutral, "mixed")).toHaveLength(12);
  });
});

describe("bySentence", () => {
  it("puts each sentence on its own line", () => {
    expect(bySentence("One thing. Then another. And a third.")).toBe(
      "One thing.\nThen another.\nAnd a third.",
    );
  });

  it("leaves a single sentence alone", () => {
    expect(bySentence("Sleep is the whole strategy today.")).toBe(
      "Sleep is the whole strategy today.",
    );
  });

  it("breaks on questions and exclamations too", () => {
    expect(bySentence("Why not? Go on!")).toBe("Why not?\nGo on!");
  });

  // Whitespace is replaced, not added to — an existing newline would
  // otherwise come back double-spaced.
  it("does not double up on whitespace that already breaks", () => {
    expect(bySentence("One.\nTwo.")).toBe("One.\nTwo.");
    expect(bySentence("One.  Two.")).toBe("One.\nTwo.");
  });

  // A trailing period with nothing after it must not leave a blank line
  // hanging under the last sentence.
  it("leaves no trailing break", () => {
    expect(bySentence("The end. ")).toBe("The end. ");
    expect(bySentence("The end.")).toBe("The end.");
  });
});
