import { StyleSheet, Text, View } from "react-native";

import { FocusCountdown } from "@/components/FocusCountdown";
import { GlassIconButton } from "@/components/GlassIconButton";
import { useLiveFocusBlock } from "@/hooks/useFocusBlocks";
import { SHADOW_LG, useTheme } from "@/utils/theme";

/**
 * The running focus block, as a floating capsule (DEX-49) — the "now playing"
 * bar for every surface except the iOS phone, which hosts the same controls in
 * its tab bar's bottom accessory instead (`FocusTimerAccessory`).
 *
 * Mounted as a **flex sibling** of the tab content in `AppShell`, the way the
 * rail and dock already are, so no screen has to reserve space for it and it
 * never covers the last card in a list. Android phones have no `AppShell`, so
 * they wrap this in `FocusTimerDock` instead.
 *
 * Renders nothing when no block is live, which is what makes it safe to mount
 * unconditionally.
 */
export function FocusTimerBar() {
  const theme = useTheme();
  const [block, { cancelFocusBlock, pauseFocusBlock, resumeFocusBlock }] =
    useLiveFocusBlock();

  if (!block) return null;

  const isRunning = block.status === "active";

  return (
    <View
      accessibilityLabel="Focus block"
      style={[
        styles.bar,
        {
          backgroundColor: theme.colors.surfaceSunken,
          borderRadius: theme.radii.full,
          boxShadow: SHADOW_LG,
          gap: theme.space.sm,
          marginHorizontal: theme.space.md,
          marginBottom: theme.space.md,
          paddingHorizontal: theme.space.md,
          paddingVertical: theme.space.sm,
        },
      ]}
    >
      <FocusCountdown
        block={block}
        style={[theme.fonts.control, { color: theme.colors.text }]}
      />
      <Text
        numberOfLines={1}
        style={[
          theme.fonts.body,
          styles.title,
          { color: theme.colors.textSecondary },
        ]}
      >
        {block.tasks.title}
      </Text>
      {/* `solid` on both: these can sit under an animated opacity (the bar is
          drawn over a ritual step mid-fade), where liquid glass samples through
          a non-opaque layer and washes out to a bare glyph — docs/frontend.md. */}
      <GlassIconButton
        accessibilityLabel={
          isRunning ? "Pause focus block" : "Resume focus block"
        }
        ionicon={isRunning ? "pause" : "play"}
        onPress={() =>
          isRunning ? pauseFocusBlock(block) : resumeFocusBlock(block)
        }
        sfSymbol={isRunning ? "pause.fill" : "play.fill"}
        size={theme.controls.sm}
        solid
      />
      <GlassIconButton
        accessibilityLabel="Stop focus block"
        ionicon="stop"
        onPress={() => cancelFocusBlock(block)}
        sfSymbol="stop.fill"
        size={theme.controls.sm}
        solid
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    flexDirection: "row",
  },
  // The title yields first: the countdown and the two controls are fixed-width
  // and are what the bar exists for, so a long task name truncates rather than
  // pushing the stop button off the end.
  title: {
    flex: 1,
  },
});
