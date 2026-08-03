// Pure string logic for a task's link, with no React Native imports, so the
// Deno MCP server can load it too (`@src/utils/taskUrl.ts`) and normalize an
// agent-supplied link by exactly the same rule the app applies to a typed one.
// Opening a link is a platform effect and lives in `utils/openUrl` instead.

/**
 * A scheme at the head of the value — `https:`, but also `mailto:` and any
 * app's own `dexter:`. Deliberately matches the scheme alone rather than a
 * whole URL: this decides whether to *add* `https://`, not whether the value is
 * valid.
 *
 * The colon must not be followed by a digit, or a bare `host:port` would read
 * as a scheme: `localhost:3000` and `example.com:8080/admin` are ordinary links
 * to paste onto a task, and left un-prefixed neither one opens. The cost is
 * that a numeric-first scheme body (`sms:15551234`) gets an `https://` it
 * didn't want, which is the rarer of the two by a wide margin.
 */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d)/i;

/** The first http(s) link inside a block of shared text. */
const FIRST_LINK = /https?:\/\/\S+/i;

/** Characters that end the sentence a link was written into, not the link. */
const TRAILING_PUNCTUATION = /[.,;:!?'"]+$/;

/**
 * A shared link without the punctuation that closed the sentence around it.
 * `FIRST_LINK` matches a run of non-space, so "see (https://example.com)."
 * yields a URL ending in `).` — stored as-is, that opens the wrong target or
 * nothing at all.
 *
 * A closing paren is only dropped when nothing in the link opened one, because
 * plenty of real URLs end in `)` — Wikipedia's disambiguated titles being the
 * usual example.
 */
const withoutTrailingPunctuation = (url: string): string => {
  const trimmed = url.replace(TRAILING_PUNCTUATION, "");
  return trimmed.endsWith(")") && !trimmed.includes("(")
    ? trimmed.slice(0, -1).replace(TRAILING_PUNCTUATION, "")
    : trimmed;
};

/**
 * A task's link as it should be stored: trimmed, `null` when empty, and given
 * an `https://` when the value is a bare host.
 *
 * Normalizes rather than validates. A link is optional, so a typo in it must
 * never block saving the task it belongs to — and the scheme is the one part
 * the user can't be expected to supply, because without it `Linking.openURL`
 * won't open `dexterplanner.com` at all.
 */
export const normalizeTaskUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
};

/**
 * The link inside an OS share payload, or null when there isn't one.
 *
 * `webUrl` is what a browser's share sheet sends, and it is already just the
 * link. Everything else arrives as text — sometimes a bare link, sometimes a
 * sentence with one in it — so the fallback pulls the first http(s) run out and
 * then sheds whatever punctuation the sentence wrapped around it.
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
