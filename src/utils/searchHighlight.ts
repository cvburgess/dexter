/**
 * Excerpts a matched entry with its terms marked (DEX-47). Relies on the RPC
 * matching substrings, not a `tsvector` — a stemmed hit may have nothing to mark.
 */

/** A run of excerpt text, either matched or not. Render matched runs emphasized. */
export type TExcerptSegment = { text: string; match: boolean };

type TRange = { start: number; end: number };

/** Characters of context kept either side of the first match. */
export const EXCERPT_RADIUS = 80;

const ELLIPSIS = "…";

/**
 * Splits the same way `search_entries` does — on whitespace, so a term can
 * never span a line break in the text below.
 */
export const searchTerms = (query: string): string[] =>
  query.trim().toLowerCase().split(/\s+/).filter(Boolean);

/**
 * Collapsed *before* matching so every offset indexes the rendered string;
 * terms hold no whitespace, so collapsing can't cost a match.
 */
const normalize = (text: string): string => text.replace(/\s+/g, " ").trim();

/** Every occurrence of every term, overlapping ones merged into single runs. */
const findRanges = (haystack: string, terms: string[]): TRange[] => {
  const lower = haystack.toLowerCase();
  const ranges: TRange[] = [];

  for (const term of terms) {
    // Advance by one, not the term's length, so self-overlapping occurrences
    // ("aa" in "aaa") are both found and merged into one run.
    let index = lower.indexOf(term);
    while (index !== -1) {
      ranges.push({ start: index, end: index + term.length });
      index = lower.indexOf(term, index + 1);
    }
  }

  return mergeRanges(ranges);
};

const mergeRanges = (ranges: TRange[]): TRange[] => {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: TRange[] = [];

  for (const range of sorted) {
    const last = merged[merged.length - 1];
    // `<=`, not `<`: two runs that merely touch ("buy" then "milk" in
    // "buymilk") should render as one highlight, not two adjacent ones.
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
};

/** The opening slice of a text, for a hit with nothing to highlight. */
const head = (haystack: string, radius: number): TExcerptSegment[] => {
  const text = haystack.slice(0, radius * 2);
  const segments: TExcerptSegment[] = [{ text, match: false }];
  if (text.length < haystack.length) {
    segments.push({ text: ELLIPSIS, match: false });
  }
  return segments;
};

/**
 * Windows `text` around its first match on `query`. Falls back to the head when
 * nothing matches: `ilike` and JS `toLowerCase()` disagree on some Unicode.
 */
export function buildExcerpt(
  text: string,
  query: string,
  radius: number = EXCERPT_RADIUS,
): TExcerptSegment[] {
  const haystack = normalize(text);
  if (!haystack) return [];

  const terms = searchTerms(query);
  const ranges = terms.length > 0 ? findRanges(haystack, terms) : [];
  if (ranges.length === 0) return head(haystack, radius);

  // Windowed on the *first* match only — spanning every match could pull in
  // the whole note, and the first hit is why the result is here.
  const [first] = ranges;
  const sliceStart = Math.max(0, first.start - radius);
  const sliceEnd = Math.min(haystack.length, first.end + radius);

  const segments: TExcerptSegment[] = [];
  if (sliceStart > 0) segments.push({ text: ELLIPSIS, match: false });

  let cursor = sliceStart;
  for (const range of ranges) {
    if (range.end <= sliceStart) continue;
    if (range.start >= sliceEnd) break;

    // Later terms can match inside the window too, so clamp each range to it
    // rather than assuming only `first` lands here.
    const start = Math.max(range.start, sliceStart);
    const end = Math.min(range.end, sliceEnd);
    if (start > cursor) {
      segments.push({ text: haystack.slice(cursor, start), match: false });
    }
    segments.push({ text: haystack.slice(start, end), match: true });
    cursor = end;
  }

  if (cursor < sliceEnd) {
    segments.push({ text: haystack.slice(cursor, sliceEnd), match: false });
  }
  if (sliceEnd < haystack.length) {
    segments.push({ text: ELLIPSIS, match: false });
  }

  return segments;
}
