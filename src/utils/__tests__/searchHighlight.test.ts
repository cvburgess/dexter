import {
  buildExcerpt,
  searchTerms,
  TExcerptSegment,
} from "@/utils/searchHighlight";

/** The excerpt as plain text, for asserting on the window rather than the runs. */
const flatten = (segments: TExcerptSegment[]): string =>
  segments.map((segment) => segment.text).join("");

/** Just the highlighted runs, which is what the search results actually mark. */
const matched = (segments: TExcerptSegment[]): string[] =>
  segments.filter((segment) => segment.match).map((segment) => segment.text);

describe("searchTerms", () => {
  it("splits on whitespace and lowercases, matching the RPC's own split", () => {
    expect(searchTerms("  Buy   MILK ")).toEqual(["buy", "milk"]);
  });

  it("returns nothing for a blank query", () => {
    expect(searchTerms("   ")).toEqual([]);
  });
});

describe("buildExcerpt", () => {
  it("marks the matched run and leaves the rest unmarked", () => {
    const segments = buildExcerpt("remember to buy milk", "milk");

    expect(segments).toEqual([
      { text: "remember to buy ", match: false },
      { text: "milk", match: true },
    ]);
  });

  it("matches case-insensitively while preserving the original casing", () => {
    const segments = buildExcerpt("Quarterly Planning", "quarterly");

    // The highlight must render the text as written, not the lowercased query.
    expect(matched(segments)).toEqual(["Quarterly"]);
  });

  it("marks every term of a multi-word query", () => {
    const segments = buildExcerpt("milk — remember to buy", "buy milk");

    expect(matched(segments)).toEqual(["milk", "buy"]);
  });

  it("marks every occurrence of a term, not just the first", () => {
    const segments = buildExcerpt("milk milk milk", "milk");

    expect(matched(segments)).toEqual(["milk", "milk", "milk"]);
  });

  it("merges overlapping and touching matches into one run", () => {
    // Two terms that abut should read as one highlight, not two adjacent ones.
    expect(matched(buildExcerpt("buymilk", "buy milk"))).toEqual(["buymilk"]);
    // And a term that overlaps itself highlights the full span.
    expect(matched(buildExcerpt("aaa", "aa"))).toEqual(["aaa"]);
  });

  it("collapses newlines so a markdown note excerpts as one line", () => {
    const segments = buildExcerpt("# Heading\n\nsome  notes\there", "notes");

    expect(flatten(segments)).toBe("# Heading some notes here");
  });

  it("windows around the first match and ellipsizes both sides", () => {
    const filler = "x".repeat(200);
    const segments = buildExcerpt(`${filler} needle ${filler}`, "needle", 10);

    // 10 characters of context each side, the separating space included.
    expect(flatten(segments)).toBe("…xxxxxxxxx needle xxxxxxxxx…");
    expect(matched(segments)).toEqual(["needle"]);
  });

  it("does not ellipsize a side it did not truncate", () => {
    const segments = buildExcerpt("needle in the haystack", "needle", 100);

    expect(flatten(segments)).toBe("needle in the haystack");
  });

  it("marks a later term that also falls inside the window", () => {
    const segments = buildExcerpt("buy the milk today", "buy milk", 100);

    expect(matched(segments)).toEqual(["buy", "milk"]);
  });

  it("falls back to the head of the text when nothing matches", () => {
    // Defensive: every row reaching the excerpt has already matched in
    // Postgres, but `ilike` case-folds by collation while this uses JS
    // `toLowerCase()`, and the two disagree on some Unicode. Degrading to the
    // head of the text beats a blank card.
    const segments = buildExcerpt("an unrelated response", "prompt");

    expect(segments).toEqual([{ text: "an unrelated response", match: false }]);
  });

  it("truncates the no-match fallback too", () => {
    const segments = buildExcerpt("y".repeat(200), "nothing", 10);

    expect(flatten(segments)).toBe(`${"y".repeat(20)}…`);
  });

  it("returns nothing for empty or whitespace-only text", () => {
    expect(buildExcerpt("", "milk")).toEqual([]);
    expect(buildExcerpt("   \n ", "milk")).toEqual([]);
  });

  it("returns the head when the query has no usable terms", () => {
    expect(buildExcerpt("some text", "   ")).toEqual([
      { text: "some text", match: false },
    ]);
  });
});
