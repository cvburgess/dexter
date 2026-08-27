import { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Theme } from "@/utils/theme";

/** Announces the attention dot to screen readers; kept generic since the
 * *reason* for the attention lives with the consumer, not this primitive. */
export function indicatorLabel(
  accessibilityLabel: string,
  indicator: boolean | undefined,
): string {
  return indicator
    ? `${accessibilityLabel}, needs attention`
    : accessibilityLabel;
}

type TFinishButtonOptions = {
  onPress?: () => void;
  label: string;
  indicator: boolean | undefined;
  theme: Theme;
};

/** Shared tail of both `GlassIconButton` variants: wraps `content` in a
 * `Pressable` when interactive, overlaying an attention dot if set (DEX-58). */
export function finishButton(
  content: ReactNode,
  { onPress, label, indicator, theme }: TFinishButtonOptions,
): ReactNode {
  const button = onPress ? (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
    >
      {content}
    </Pressable>
  ) : (
    content
  );

  if (!indicator) return button;

  // An absolute child anchors to its parent View without needing an explicit
  // `position: "relative"` (the React Native default), so the wrapper is bare.
  return (
    <View>
      {button}
      <View
        pointerEvents="none"
        style={[
          styles.dot,
          {
            backgroundColor: theme.colors.priority[0],
            borderRadius: theme.radii.full,
            // A ring in the surface color separates the dot from the button edge.
            borderColor: theme.colors.background,
          },
        ]}
        testID="attention-indicator"
      />
    </View>
  );
}

// Decorative, not part of the control scale — sized to read as a badge on
// any diameter (docs/design.md exceptions list).
const styles = StyleSheet.create({
  dot: {
    borderWidth: 1.5,
    height: 11,
    position: "absolute",
    right: -1,
    top: -1,
    width: 11,
  },
});
