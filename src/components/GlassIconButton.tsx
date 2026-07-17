import Ionicons from "@react-native-vector-icons/ionicons";
import { StyleSheet, View } from "react-native";

import { useTheme, withOpacity } from "@/utils/theme";

import { finishButton, indicatorLabel } from "./GlassIconButton.indicator";
import { TGlassIconButtonProps } from "./GlassIconButton.types";

const DEFAULT_SIZE = 40;

/**
 * Android/web (and `tsc`) implementation of the circular icon button. The iOS
 * liquid-glass variant lives in `GlassIconButton.ios.tsx`; `expo-glass-effect`
 * renders nothing but a bare `View` off iOS, so here we draw a plain bordered
 * circle and use an Ionicons glyph (SF Symbols don't render on Android/web).
 */
export function GlassIconButton({
  ionicon,
  accessibilityLabel,
  size = DEFAULT_SIZE,
  onPress,
  active,
  indicator,
}: TGlassIconButtonProps) {
  const theme = useTheme();
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
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.card,
          borderColor: withOpacity(theme.colors.text, 0.1),
        },
      ]}
    >
      <Ionicons color={iconColor} name={ionicon} size={size * 0.5} />
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
