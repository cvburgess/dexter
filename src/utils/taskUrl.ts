import { Linking, Platform } from "react-native";

/**
 * A scheme at the head of the value — `https:`, but also `mailto:` and any
 * app's own `dexter:`. Deliberately matches the scheme alone rather than a
 * whole URL: this decides whether to *add* `https://`, not whether the value is
 * valid.
 */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** The first http(s) link inside a block of shared text. */
const FIRST_LINK = /https?:\/\/\S+/i;

/**
 * A task's link as it should be stored: trimmed, `null` when empty, and given
 * an `https://` when the user typed a bare host.
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
 * Opens a task's link outside the app.
 *
 * Web opens a new tab rather than following the link in place: the task list is
 * where the user was, and a menu action shouldn't navigate them out of it. On
 * native this is the same `Linking.openURL` the OAuth consent screen uses —
 * `expo-linking` is only for parsing Dexter's own deep links.
 */
export const openTaskUrl = (url: string): void => {
  if (Platform.OS === "web") {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    void Linking.openURL(url);
  }
};

/**
 * The link inside an OS share payload, or null when there isn't one.
 *
 * `webUrl` is what a browser's share sheet sends. Everything else arrives as
 * text — sometimes a bare link, sometimes a page title with the link appended —
 * so the fallback pulls the first http(s) run out of it rather than treating
 * the whole string as a URL.
 */
export const extractSharedUrl = (
  webUrl?: string | null,
  text?: string | null,
): string | null => {
  const trimmedWebUrl = webUrl?.trim();
  if (trimmedWebUrl) return trimmedWebUrl;
  return text?.match(FIRST_LINK)?.[0] ?? null;
};
