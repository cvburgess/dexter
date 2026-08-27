import { StyleSheet, View } from "react-native";

import { useTheme } from "@/utils/theme";

import { finishButton, indicatorLabel } from "./GlassIconButton.indicator";
import { TGlassIconButtonProps } from "./GlassIconButton.types";
import { Icon } from "./Icon";

/** Android/web (and `tsc`) circular icon button — a plain bordered circle,
 * since `expo-glass-effect` renders nothing off iOS. */
export function GlassIconButton({
  sfSymbol,
  ionicon,
  accessibilityLabel,
  size,
  onPress,
  active,
  indicator,
}: TGlassIconButtonProps) {
  const theme = useTheme();
  const diameter = size ?? theme.controls.md;
  // `undefined` and `false` both resolve to the default text color — only an
  // explicit `active={true}` switches to the primary tint.
  const iconColor = active ? theme.colors.primary : theme.colors.text;
  const label = indicatorLabel(accessibilityLabel, indicator);

  const circle = (
    <View
      accessibilityLabel={onPress ? undefined : label}
      style={[
        styles.circle,
        {
          width: diameter,
          height: diameter,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors.surfaceSunken,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Icon
        sf={sfSymbol}
        ionicon={ionicon}
        size={diameter * 0.5}
        color={iconColor}
      />
    </View>
  );

  return finishButton(circle, { onPress, label, indicator, theme });
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
  },
});
