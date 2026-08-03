import { Linking, Platform } from "react-native";

/**
 * Opens a link outside the app.
 *
 * Web opens a new tab rather than following the link in place: a task's link is
 * reached from a menu over the list the user is working in, and following it
 * there would navigate them out of the app entirely. On native this is the same
 * `Linking.openURL` the OAuth consent screen uses — `expo-linking` is only for
 * parsing Dexter's own deep links, not for opening someone else's.
 */
export const openUrl = (url: string): void => {
  if (Platform.OS === "web") {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    void Linking.openURL(url);
  }
};
