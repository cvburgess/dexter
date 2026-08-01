import Ionicons from "@react-native-vector-icons/ionicons";

import { useTheme } from "@/utils/theme";

import type { TIconProps } from "./Icon.types";

/**
 * Android/web (and `tsc`) icon: an Ionicon. The iOS variant lives in
 * `Icon.ios.tsx` and draws the SF Symbol instead.
 *
 * Every icon in the app goes through here so the two names travel together and
 * neither platform can silently fall back to a third icon set (DEX-61). The one
 * exception is `NativeTabs.Trigger.Icon`, which accepts only an SF Symbol and an
 * Android drawable — see `docs/design.md`.
 */
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
