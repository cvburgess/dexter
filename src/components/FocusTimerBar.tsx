import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { FocusCountdown } from "@/components/FocusCountdown";
import type { TGlassIconButtonProps } from "@/components/GlassIconButton.types";
import { Icon } from "@/components/Icon";
import { useFocusTimer } from "@/hooks/useFocusTimer";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { FOCUS_TIMER_MAX_WIDTH } from "@/utils/breakpoints";
import { SHADOW_LG, useTheme, withOpacity } from "@/utils/theme";

/** Floating capsule (DEX-49) for every surface but the iOS phone accessory. */
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
          // Extra room on large screens: compact density tightens space.md
          // but the capsule keeps full width, crowding the countdown.
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

/** `GlassIconButton`'s shape, keyed to the capsule. Local, not a prop on it —
 * its other call sites all sit on a page background. */
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
    // A hairline of its own — floating over content means no shared edge,
    // and the shadow alone disappears against a busy list.
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    width: "100%",
  },
  // Yields first: a long name truncates rather than pushing Stop off the
  // end. Centered within the remaining space, not the capsule.
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
