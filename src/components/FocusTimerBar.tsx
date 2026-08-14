import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { FocusCountdown } from "@/components/FocusCountdown";
import type { TGlassIconButtonProps } from "@/components/GlassIconButton.types";
import { Icon } from "@/components/Icon";
import { useFocusTimer } from "@/hooks/useFocusTimer";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { FOCUS_TIMER_MAX_WIDTH } from "@/utils/breakpoints";
import { SHADOW_LG, useTheme, withOpacity } from "@/utils/theme";

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
  const isLargeScreen = useIsLargeDevice();
  const { actions, block } = useFocusTimer();

  if (!block) return null;

  const isRunning = block.status === "active";

  return (
    <View
      accessibilityLabel="Focus block"
      style={[
        styles.bar,
        {
          backgroundColor: theme.colors.primary,
          borderColor: withOpacity(theme.colors.primaryContent, 0.25),
          borderRadius: theme.radii.full,
          boxShadow: SHADOW_LG,
          gap: theme.space.md,
          maxWidth: FOCUS_TIMER_MAX_WIDTH,
          padding: theme.space.md,
          // A touch more room before the countdown on a large screen, where the
          // compact density tier tightens `space.md` but the capsule keeps its
          // full width — without it the figure reads as crowded against the
          // leading curve.
          paddingLeft: theme.space.md + (isLargeScreen ? theme.space.sm : 0),
        },
      ]}
    >
      <FocusCountdown
        block={block}
        style={[theme.fonts.control, { color: theme.colors.primaryContent }]}
      />
      <Text
        numberOfLines={1}
        style={[
          theme.fonts.body,
          styles.title,
          { color: withOpacity(theme.colors.primaryContent, 0.8) },
        ]}
      >
        {block.tasks.title}
      </Text>
      <FocusControl
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
      />
      <FocusControl
        accessibilityLabel="Stop focus block"
        ionicon="stop"
        onPress={() => actions.cancelFocusBlock(block)}
        sfSymbol="stop.fill"
      />
    </View>
  );
}

/**
 * One of the bar's circular controls: the same shape `GlassIconButton` draws,
 * but keyed to the capsule it sits on — a `primaryContent` outline and glyph
 * over a `primary` fill.
 *
 * Local rather than a `GlassIconButton` prop: that component fixes its own
 * colors (`surfaceSunken` fill, `text` glyph) because every one of its ~dozen
 * call sites sits on a page background, and opening it up to arbitrary colors
 * to serve the one control that doesn't would make the exception everyone's
 * problem.
 */
function FocusControl({
  accessibilityLabel,
  ionicon,
  onPress,
  sfSymbol,
}: Pick<
  TGlassIconButtonProps,
  "accessibilityLabel" | "ionicon" | "onPress" | "sfSymbol"
>) {
  const theme = useTheme();
  const diameter = theme.controls.md;

  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.control,
        {
          backgroundColor: theme.colors.primary,
          borderColor: theme.colors.primaryContent,
          borderRadius: theme.radii.full,
          height: diameter,
          width: diameter,
        },
      ]}
    >
      <Icon
        color={theme.colors.primaryContent}
        ionicon={ionicon}
        sf={sfSymbol}
        size={diameter * 0.5}
      />
    </TouchableOpacity>
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
  //
  // Centred **within that remaining space**, not within the capsule — the
  // countdown and the button pair are different widths, so the two are not the
  // same thing. Truly centring it against the capsule would mean floating the
  // title over the row, where a long name would run under the controls.
  title: {
    flex: 1,
    textAlign: "center",
  },
  control: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
  },
});
