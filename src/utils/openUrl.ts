import { Linking, Platform } from "react-native";

import { showAlert } from "./alert";

// Web opens a new tab rather than navigating away from the list the link was
// found in. `normalizeTaskUrl` never validates, so a garbage URL rejects here.
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
