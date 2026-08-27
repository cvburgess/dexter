// No React Native imports, so the Deno MCP server loads this too and applies
// the same normalization. Opening a link lives in `utils/openUrl` instead.

/**
 * Matches the scheme alone — this decides whether to *add* `https://`, not
 * validity. `(?!\d)` keeps `localhost:3000` from reading as a scheme.
 */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d)/i;

/** The first http(s) link inside a block of shared text. */
const FIRST_LINK = /https?:\/\/\S+/i;

/** Characters that end the sentence a link was written into, not the link. */
const TRAILING_PUNCTUATION = /[.,;:!?'"]+$/;

/**
 * `FIRST_LINK` matches a run of non-space, so the sentence's closing `).` comes
 * along. A `)` is only dropped when the link opened none — real URLs end in `)`.
 */
const withoutTrailingPunctuation = (url: string): string => {
  const trimmed = url.replace(TRAILING_PUNCTUATION, "");
  return trimmed.endsWith(")") && !trimmed.includes("(")
    ? trimmed.slice(0, -1).replace(TRAILING_PUNCTUATION, "")
    : trimmed;
};

/**
 * Normalizes rather than validates: a typo must never block saving the task,
 * and without a scheme `Linking.openURL` won't open a bare host at all.
 */
export const normalizeTaskUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
};

/**
 * `webUrl` is already just the link; text may be a sentence with one in it, so
 * the fallback pulls the first http(s) run and sheds the sentence's punctuation.
 */
export const extractSharedUrl = (
  webUrl?: string | null,
  text?: string | null,
): string | null => {
  const trimmedWebUrl = webUrl?.trim();
  if (trimmedWebUrl) return trimmedWebUrl;

  const match = text?.match(FIRST_LINK)?.[0];
  return match ? withoutTrailingPunctuation(match) : null;
};
