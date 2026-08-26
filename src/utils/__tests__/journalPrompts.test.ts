import {
  hasPromptsFor,
  newTemplatePrompt,
  parseTemplatePrompts,
  promptPeriod,
  promptsFor,
  type TTemplatePrompt,
} from "@/utils/journalPrompts";

const PROMPTS: TTemplatePrompt[] = [
  { id: "a", prompt: "Grateful for", period: "am" },
  { id: "b", prompt: "Today's highlight", period: "pm" },
  { id: "c", prompt: "What would make today great", period: "am" },
];

describe("parseTemplatePrompts", () => {
  it("reads a stored list", () => {
    expect(
      parseTemplatePrompts([
        { id: "a", prompt: "Grateful for", period: "am" },
        { id: "b", prompt: "Today's highlight", period: "pm" },
      ]),
    ).toEqual([
      { id: "a", prompt: "Grateful for", period: "am" },
      { id: "b", prompt: "Today's highlight", period: "pm" },
    ]);
  });

  // The column's CHECK tests `jsonb_typeof`, not the shape of the elements, so
  // every field here is coerced rather than trusted — callers `.map()` the
  // result and read `.period` off each entry.
  it("survives a column that is not an array at all", () => {
    expect(parseTemplatePrompts(null)).toEqual([]);
    expect(parseTemplatePrompts(undefined)).toEqual([]);
    expect(parseTemplatePrompts("Grateful for")).toEqual([]);
    expect(parseTemplatePrompts({ prompt: "Grateful for" })).toEqual([]);
  });

  it("drops elements that are not objects", () => {
    expect(
      parseTemplatePrompts(["Grateful for", null, { prompt: "Kept" }]),
    ).toEqual([{ id: "i2", prompt: "Kept", period: "am" }]);
  });

  it("reads an unknown or missing period as morning", () => {
    expect(
      parseTemplatePrompts([
        { id: "a", prompt: "No period" },
        { id: "b", prompt: "Nonsense", period: "noon" },
      ]),
    ).toEqual([
      { id: "a", prompt: "No period", period: "am" },
      { id: "b", prompt: "Nonsense", period: "am" },
    ]);
  });

  // Position, not a fresh mint: an id that changed on every read would re-key
  // the settings list on every render.
  it("falls back to a stable position id, the same one every read", () => {
    const stored = [{ prompt: "Grateful for", period: "am" }];

    expect(parseTemplatePrompts(stored)).toEqual([
      { id: "i0", prompt: "Grateful for", period: "am" },
    ]);
    expect(parseTemplatePrompts(stored)).toEqual(parseTemplatePrompts(stored));
  });
});

describe("newTemplatePrompt", () => {
  it("starts blank and in the morning", () => {
    expect(newTemplatePrompt()).toMatchObject({ prompt: "", period: "am" });
  });

  it("mints a distinct id each time", () => {
    expect(newTemplatePrompt().id).not.toBe(newTemplatePrompt().id);
  });
});

describe("promptsFor", () => {
  it("keeps only the ritual's own prompts, in the stored order", () => {
    expect(promptsFor(PROMPTS, "am")).toEqual([PROMPTS[0], PROMPTS[2]]);
    expect(promptsFor(PROMPTS, "pm")).toEqual([PROMPTS[1]]);
  });
});

describe("hasPromptsFor", () => {
  it("answers per ritual, not for the journal as a whole", () => {
    const morningOnly = [PROMPTS[0]];
    const eveningOnly = [PROMPTS[1]];

    expect(hasPromptsFor(morningOnly, "am")).toBe(true);
    expect(hasPromptsFor(morningOnly, "pm")).toBe(false);
    expect(hasPromptsFor(eveningOnly, "am")).toBe(false);
    expect(hasPromptsFor(eveningOnly, "pm")).toBe(true);
    expect(hasPromptsFor([], "am")).toBe(false);
  });

  // A prompt tapped into existence but not yet typed still counts: the morning
  // list has always rendered one as an unlabelled field, and excluding it would
  // make the step flicker out of the ritual until the first keystroke.
  it("counts a blank prompt", () => {
    expect(hasPromptsFor([newTemplatePrompt("pm")], "pm")).toBe(true);
  });
});

describe("promptPeriod", () => {
  it("reads a stamped period", () => {
    expect(promptPeriod({ period: "pm" })).toBe("pm");
    expect(promptPeriod({ period: "am" })).toBe("am");
  });

  // Every journal entry written before the split carries no period, as does
  // anything an older build writes today. Both must read as morning, matching
  // how the migration treats the prompts they were seeded from.
  it("falls back to the morning for an entry written before the split", () => {
    expect(promptPeriod({})).toBe("am");
    expect(promptPeriod({ period: null })).toBe("am");
  });

  // That column is jsonb with no shape check, so anything can be in there.
  it("falls back rather than trusting a value it does not know", () => {
    expect(promptPeriod({ period: "evening" as never })).toBe("am");
  });
});
