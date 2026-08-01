import { StyleSheet, TouchableOpacity } from "react-native";

import { Icon } from "@/components/Icon";
import { useTheme } from "@/utils/theme";

/**
 * The space a field must reserve on its trailing edge to clear the button:
 * the glyph, plus the field's own `md` inset on either side of it. Exported so
 * a call site's `paddingRight` can't drift from the button parked over it.
 */
export const rowDeleteInset = (theme: ReturnType<typeof useTheme>) =>
  theme.icons.md + theme.space.md * 2;

type TRowDeleteButtonProps = {
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
};

/**
 * Removes the row it sits in — a journal prompt, a calendar feed. One component
 * for both, which is also what keeps them on one glyph: they had each drawn
 * their own `Ionicons` directly (one at a literal 22, one at `icons.md`), which
 * bypassed `components/Icon.tsx` and so rendered an Ionicon on iOS where the
 * rest of the app draws an SF Symbol.
 *
 * An **X**, not a trash can: the row is a line in a list the user is editing,
 * and removing it is undone by typing it again. The trash stays in `MoreMenu`
 * and `SubtaskRow`, where deleting destroys a stored record.
 *
 * **Positioned inside the field, not beside it.** The button absolutely
 * occupies the field's trailing edge, so the input keeps the row's full width;
 * the field reserves `rowDeleteInset` on the right so its text scrolls under
 * nothing. Render it *after* the input so it wins the touch rather than
 * focusing the field beneath it.
 */
export function RowDeleteButton({
  accessibilityLabel,
  onPress,
  testID,
}: TRowDeleteButtonProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.button, { paddingHorizontal: theme.space.md }]}
      testID={testID}
    >
      <Icon
        color={theme.colors.error}
        ionicon="close-outline"
        sf="xmark"
        size={theme.icons.md}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Full height rather than centred on a fixed size: the field's own padding
  // sets how tall the row is, and matching it keeps the glyph on the text's
  // center line without either one knowing the other's numbers.
  button: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    top: 0,
  },
});
