import {
  hasPromptsFor,
  mergeTemplatePrompts,
  promptPeriod,
  splitTemplatePrompts,
} from "@/utils/journalPrompts";

describe("mergeTemplatePrompts", () => {
  it("reads the two columns as one list, morning first", () => {
    expect(
      mergeTemplatePrompts(["Highlight", "Grateful for"], ["What went well?"]),
    ).toEqual([
      { prompt: "Highlight", period: "am" },
      { prompt: "Grateful for", period: "am" },
      { prompt: "What went well?", period: "pm" },
    ]);
  });

  // Every prompt that predates DEX-151 is in `template_prompts`, which is the
  // morning list — so an unmigrated account reads as morning-only with no
  // backfill, which is exactly what the migration relies on.
  it("reads an account with no evening prompts as morning-only", () => {
    expect(mergeTemplatePrompts(["Highlight"], [])).toEqual([
      { prompt: "Highlight", period: "am" },
    ]);
  });

  it("handles a journal that runs only in the evening", () => {
    expect(mergeTemplatePrompts([], ["What went well?"])).toEqual([
      { prompt: "What went well?", period: "pm" },
    ]);
  });
});

describe("splitTemplatePrompts", () => {
  it("partitions the list back into the two columns", () => {
    expect(
      splitTemplatePrompts([
        { prompt: "Highlight", period: "am" },
        { prompt: "What went well?", period: "pm" },
        { prompt: "Grateful for", period: "am" },
      ]),
    ).toEqual({
      templatePrompts: ["Highlight", "Grateful for"],
      templatePromptsPm: ["What went well?"],
    });
  });

  // Both arrays every time: a period change is one prompt leaving one column
  // and joining the other, and writing only the column it joined would leave it
  // in both — the one state this model has no way to mean.
  it("returns both columns even when one of them is empty", () => {
    expect(
      splitTemplatePrompts([{ prompt: "Highlight", period: "am" }]),
    ).toEqual({ templatePrompts: ["Highlight"], templatePromptsPm: [] });
  });

  it("round-trips a merge without reordering within a period", () => {
    const columns = {
      templatePrompts: ["Highlight", "Grateful for"],
      templatePromptsPm: ["What went well?", "What I would change"],
    };

    expect(
      splitTemplatePrompts(
        mergeTemplatePrompts(
          columns.templatePrompts,
          columns.templatePromptsPm,
        ),
      ),
    ).toEqual(columns);
  });
});

describe("hasPromptsFor", () => {
  it("answers per ritual, not for the journal as a whole", () => {
    expect(hasPromptsFor(["Highlight"], [], "am")).toBe(true);
    expect(hasPromptsFor(["Highlight"], [], "pm")).toBe(false);
    expect(hasPromptsFor([], ["What went well?"], "am")).toBe(false);
    expect(hasPromptsFor([], ["What went well?"], "pm")).toBe(true);
  });

  // A prompt tapped into existence but not yet typed still counts: the morning
  // list has always rendered one as an unlabelled field, and excluding it would
  // make the step flicker out of the ritual until the first keystroke.
  it("counts a blank prompt", () => {
    expect(hasPromptsFor([], [""], "pm")).toBe(true);
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

  // The column is jsonb with no CHECK, so anything at all can be in there.
  it("falls back rather than trusting a value it does not know", () => {
    expect(promptPeriod({ period: "evening" as never })).toBe("am");
  });
});
