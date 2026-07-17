import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { SymbolView } from "expo-symbols";
import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme, withOpacity } from "@/utils/theme";

import { finishButton, indicatorLabel } from "./GlassIconButton.indicator";
import { TGlassIconButtonProps } from "./GlassIconButton.types";

const DEFAULT_SIZE = 40;

/**
 * iOS circular action button using Apple's liquid glass (`expo-glass-effect`),
 * icon-only. Falls back to a plain bordered circle when glass isn't available
 * (iOS < 26 / reduce transparency). `isInteractive` (the liquid touch response)
 * is enabled only for standalone `onPress` buttons — as an `IconMenu` trigger
 * we leave it off so it can't intercept the menu-opening tap.
 */
export function GlassIconButton({
  sfSymbol,
  accessibilityLabel,
  size = DEFAULT_SIZE,
  onPress,
  active,
  indicator,
}: TGlassIconButtonProps) {
  const theme = useTheme();
  const circle = { width: size, height: size, borderRadius: size / 2 };
  // Only an explicit `active={false}` switches away from the default primary
  // tint — `undefined` and `true` both resolve to it.
  const tintColor = active === false ? theme.colors.text : theme.colors.primary;
  const icon = (
    <SymbolView name={sfSymbol} size={size * 0.5} tintColor={tintColor} />
  );

  const label = indicatorLabel(accessibilityLabel, indicator);
  // The trigger anchor doesn't take the a11y label when a Pressable wraps it.
  const anchorLabel = onPress ? undefined : label;

  const content: ReactNode = isLiquidGlassAvailable() ? (
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
          backgroundColor: theme.colors.card,
          borderColor: withOpacity(theme.colors.text, 0.1),
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
