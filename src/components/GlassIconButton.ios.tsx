import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "@/utils/theme";

import { finishButton, indicatorLabel } from "./GlassIconButton.indicator";
import { TGlassIconButtonProps } from "./GlassIconButton.types";
import { Icon } from "./Icon";

/**
 * iOS circular action button using Apple's liquid glass (`expo-glass-effect`),
 * icon-only. Falls back to a plain bordered circle when glass isn't available
 * (iOS < 26 / reduce transparency), or when the caller passes `solid` because it
 * sits under an animated opacity the glass cannot sample through.
 * `isInteractive` (the liquid touch response) is enabled only for standalone
 * `onPress` buttons — as an `IconMenu` trigger we leave it off so it can't
 * intercept the menu-opening tap.
 */
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
