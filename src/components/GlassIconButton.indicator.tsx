import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Theme } from "@/utils/theme";

/**
 * Wraps a `GlassIconButton`'s content with a small warning-yellow attention dot
 * in the top-right corner when `indicator` is true (DEX-58). Shared by the
 * native and Android/web variants so the dot is identical on every platform.
 * `theme.colors.priority[0]` is the daisyUI "warning" (yellow) token — the
 * legacy app's left-behind color — as documented on `Theme.colors.priority` in
 * `theme.ts`; reused here rather than adding a dedicated `warning` token.
 */
export function withIndicator(
  content: ReactNode,
  indicator: boolean | undefined,
  theme: Theme,
): ReactNode {
  if (!indicator) return content;
  return (
    <View style={styles.wrapper}>
      {content}
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
  // No size of its own: sizes to the wrapped button so the absolute dot anchors
  // to that button's top-right corner.
  wrapper: {
    position: "relative",
  },
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
