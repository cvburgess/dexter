import { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Theme } from "@/utils/theme";

/**
 * The button's accessibility label, annotated when the attention dot shows so
 * screen readers announce that the button needs attention. Kept generic — the
 * dot is a generic affordance, so the *reason* for the attention lives with the
 * consumer, not this shared primitive.
 */
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

/**
 * Shared tail of both `GlassIconButton` variants: wrap the platform-rendered
 * `content` in a `Pressable` when interactive, then overlay a small
 * warning-yellow attention dot in the top-right corner when `indicator` is set
 * (DEX-58). `content` already carries the anchor a11y label for the
 * non-interactive (menu-trigger) case; the `Pressable` owns it otherwise.
 * `theme.colors.priority[0]` is the daisyUI "warning" (yellow) token — the
 * legacy app's left-behind color, documented on `Theme.colors.priority` in
 * `theme.ts` — reused rather than adding a dedicated `warning` token.
 */
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
            // A ring in the surface color separates the dot from the button edge.
            borderColor: theme.colors.background,
          },
        ]}
        testID="attention-indicator"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    borderRadius: 999,
    borderWidth: 1.5,
    height: 11,
    position: "absolute",
    right: -1,
    top: -1,
    width: 11,
  },
});
