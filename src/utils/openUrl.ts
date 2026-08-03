import { Linking, Platform } from "react-native";

import { showAlert } from "./alert";

/**
 * Opens a link outside the app.
 *
 * Web opens a new tab rather than following the link in place: a task's link is
 * reached from a menu over the list the user is working in, and following it
 * there would navigate them out of the app entirely. On native this is the same
 * `Linking.openURL` the OAuth consent screen uses — `expo-linking` is only for
 * parsing Dexter's own deep links, not for opening someone else's.
 *
 * The failure is handled rather than swallowed, because `normalizeTaskUrl`
 * deliberately never validates: a link saved as `https://not a url` is exactly
 * what the form allows, and `Linking.openURL` *rejects* on it. Left as a bare
 * `void`, that would surface as an unhandled promise rejection and the menu row
 * would look like it did nothing at all.
 */
export const openUrl = (url: string): void => {
  if (Platform.OS === "web") {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    Linking.openURL(url).catch(() => {
      showAlert(
        "Couldn't open this link",
        `We couldn't open ${url}. Check the link on the task and try again.`,
      );
    });
  }
};
