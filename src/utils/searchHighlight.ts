/**
 * Turns a matched note or journal entry into a short excerpt with the matching
 * terms marked (DEX-47).
 *
 * This is the payoff of the RPC matching on substrings rather than a `tsvector`:
 * the offsets are exact, so what gets highlighted is provably what matched. A
 * stemming search would report the row as a hit while the literal term never
 * appears in it, leaving nothing to mark.
 */

/** A run of excerpt text, either matched or not. Render matched runs emphasized. */
export type TExcerptSegment = { text: string; match: boolean };

type TRange = { start: number; end: number };

/** Characters of context kept either side of the first match. */
export const EXCERPT_RADIUS = 80;

const ELLIPSIS = "…";

/**
 * Splits a query the same way `search_entries` does — on whitespace, so a term
 * can never contain a space and therefore can never span a line break in the
 * text below.
 */
export const searchTerms = (query: string): string[] =>
  query.trim().toLowerCase().split(/\s+/).filter(Boolean);

/**
 * Collapses runs of whitespace so a markdown note excerpts as one tidy line
 * instead of carrying its newlines into the card.
 *
 * Done *before* matching, not after, so every offset below indexes the string
 * that actually gets rendered. Collapsing can't cost a match: terms hold no
 * whitespace, so none of them straddles the runs being collapsed.
 */
const normalize = (text: string): string => text.replace(/\s+/g, " ").trim();

/** Every occurrence of every term, overlapping ones merged into single runs. */
const findRanges = (haystack: string, terms: string[]): TRange[] => {
  const lower = haystack.toLowerCase();
  const ranges: TRange[] = [];

  for (const term of terms) {
    // Advance by one rather than by the term's length so self-overlapping
    // occurrences ("aa" in "aaa") are both found and merged into one run,
    // instead of the second being skipped and highlighted as a shorter span.
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
 * An excerpt of `text` windowed around its first match on `query`, split into
 * matched and unmatched runs.
 *
 * Returns the head of the text when nothing matches, which is a real case rather
 * than a defensive one: a journal result matches on the prompt *or* the
 * response, so the half that didn't match still has to render.
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

  // Windowed on the *first* match only. Trying to span every match would either
  // pull in the whole note or need several disjoint windows, and the first hit
  // is what tells the user why this result is here.
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
