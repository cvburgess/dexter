import { Platform, type TextStyle } from "react-native";

/**
 * Suppresses the browser's focus ring on a text input, matching the legacy app:
 * the caret is cue enough that a field is being edited, and a ring is
 * particularly wrong around an inline title editor, where it reads as a form
 * control appearing inside the card.
 *
 * `outlineStyle: "none"` is the only spelling that works. Chrome draws its ring
 * with `outline-style: auto`, and that makes it ignore both `outline-width` and
 * `outline-color` — so zeroing the width leaves the ring untouched. React
 * Native's own style types model only the values that *draw* an outline, which
 * is what the cast is for; react-native-web passes the value straight through
 * to CSS.
 *
 * Empty off web, where there is no ring to suppress.
 */
export const NO_FOCUS_RING: TextStyle = Platform.select({
  web: { outlineStyle: "none" } as unknown as TextStyle,
  default: {},
});
