import { StyleSheet, TouchableOpacity } from "react-native";

import { Icon } from "@/components/Icon";
import { useTheme } from "@/utils/theme";

// The trailing space a field must reserve to clear the button; exported so a
// call site's paddingRight can't drift from the button parked over it.
export const rowDeleteInset = (theme: ReturnType<typeof useTheme>) =>
  theme.icons.md + theme.space.md * 2;

type TRowDeleteButtonProps = {
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
};

// An X, not a trash can — removing a row here is undone by retyping it; the
// trash stays in MoreMenu/SubtaskRow, which destroy a stored record. Absolute
// inside the field's trailing edge; render after the input to win the touch.
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
  // Full height, not a fixed size — keeps the glyph on the text's center line
  // without either side knowing the other's numbers.
  button: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    top: 0,
  },
});
