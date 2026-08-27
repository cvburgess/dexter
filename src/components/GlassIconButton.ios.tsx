import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "@/utils/theme";

import { finishButton, indicatorLabel } from "./GlassIconButton.indicator";
import { TGlassIconButtonProps } from "./GlassIconButton.types";
import { Icon } from "./Icon";

/** iOS liquid-glass circular button, falling back to plain bordered circle
 * when unavailable/`solid`; `isInteractive` off as an IconMenu trigger. */
export function GlassIconButton({
  sfSymbol,
  ionicon,
  accessibilityLabel,
  size,
  onPress,
  active,
  indicator,
  solid,
}: TGlassIconButtonProps) {
  const theme = useTheme();
  const diameter = size ?? theme.controls.md;
  const circle = {
    width: diameter,
    height: diameter,
    borderRadius: theme.radii.full,
  };
  // Only an explicit `active={false}` switches away from the default primary
  // tint — `undefined` and `true` both resolve to it.
  const tintColor = active === false ? theme.colors.text : theme.colors.primary;
  const icon = (
    <Icon
      sf={sfSymbol}
      ionicon={ionicon}
      size={diameter * 0.5}
      color={tintColor}
    />
  );

  const label = indicatorLabel(accessibilityLabel, indicator);
  // The trigger anchor doesn't take the a11y label when a Pressable wraps it.
  const anchorLabel = onPress ? undefined : label;

  // `solid` reuses the pre-26 fallback branch rather than a third rendering
  // — opting out of glass wants the circle already drawn everywhere else.
  const content: ReactNode =
    !solid && isLiquidGlassAvailable() ? (
      <GlassView
        accessibilityLabel={anchorLabel}
        glassEffectStyle="regular"
        isInteractive={!!onPress}
        style={[styles.center, circle]}
      >
        {icon}
      </GlassView>
    ) : (
      <View
        accessibilityLabel={anchorLabel}
        style={[
          styles.center,
          styles.fallback,
          circle,
          {
            backgroundColor: theme.colors.surfaceSunken,
            borderColor: theme.colors.border,
          },
        ]}
      >
        {icon}
      </View>
    );

  return finishButton(content, { onPress, label, indicator, theme });
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  fallback: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
