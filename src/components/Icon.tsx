import Ionicons from "@react-native-vector-icons/ionicons";

import { useTheme } from "@/utils/theme";

import type { TIconProps } from "./Icon.types";

/** Android/web (and tsc) icon: an Ionicon; Icon.ios.tsx draws the SF Symbol
 * instead, so neither falls back to a third set (DEX-61). */
export function Icon({ ionicon, size, color }: TIconProps) {
  const theme = useTheme();

  return (
    <Ionicons
      name={ionicon}
      size={size ?? theme.icons.md}
      color={color ?? theme.colors.text}
    />
  );
}
