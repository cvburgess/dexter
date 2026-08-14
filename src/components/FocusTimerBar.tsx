import { StyleSheet, Text, View } from "react-native";

import { FocusCountdown } from "@/components/FocusCountdown";
import { GlassIconButton } from "@/components/GlassIconButton";
import { useFocusTimer } from "@/hooks/useFocusTimer";
import { FOCUS_TIMER_MAX_WIDTH } from "@/utils/breakpoints";
import { SHADOW_LG, useTheme } from "@/utils/theme";

/**
 * The running focus block, as a floating capsule (DEX-49) — the "now playing"
 * bar for every surface except the iOS phone, which hosts the same controls in
 * its tab bar's bottom accessory instead (`FocusTimerAccessory`).
 *
 * It **floats over** the content rather than sitting in the layout, the way
 * Apple Music's player does: a timer is a thing you glance at, not a region of
 * the screen, and reserving a strip of every screen for one that is usually
 * absent would move the whole app's bottom edge whenever a block starts.
 * Positioning is the caller's job — `AppShell` pins it over the tab content,
 * `FocusTimerDock` above Android's navigation bar — so this only has to centre
 * itself and stop growing (`FOCUS_TIMER_MAX_WIDTH`).
 *
 * Reads the module store rather than the query hooks so that stopping goes
 * through the confirmation `FocusTimerHost` owns. Renders nothing when no block
 * is live, which is what makes it safe to mount unconditionally.
 */
export function FocusTimerBar() {
  const theme = useTheme();
  const { actions, block } = useFocusTimer();

  if (!block) return null;

  const isRunning = block.status === "active";

  return (
    <View
      accessibilityLabel="Focus block"
      style={[
        styles.bar,
        {
          backgroundColor: theme.colors.surfaceSunken,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.full,
          boxShadow: SHADOW_LG,
          gap: theme.space.md,
          maxWidth: FOCUS_TIMER_MAX_WIDTH,
          padding: theme.space.md,
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
          isRunning
            ? actions.pauseFocusBlock(block)
            : actions.resumeFocusBlock(block)
        }
        sfSymbol={isRunning ? "pause.fill" : "play.fill"}
        size={theme.controls.md}
        solid
      />
      <GlassIconButton
        accessibilityLabel="Stop focus block"
        ionicon="stop"
        onPress={() => actions.cancelFocusBlock(block)}
        sfSymbol="stop.fill"
        size={theme.controls.md}
        solid
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignItems: "center",
    // Floating over content means there is no shared edge to read the capsule
    // against, so it carries a hairline of its own — the shadow alone
    // disappears against a busy list.
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    width: "100%",
  },
  // The title yields first: the countdown and the two controls are fixed-width
  // and are what the bar exists for, so a long task name truncates rather than
  // pushing the stop button off the end.
  title: {
    flex: 1,
  },
});
