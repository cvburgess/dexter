import { SymbolView } from "expo-symbols";

import { useTheme } from "@/utils/theme";

import type { TIconProps } from "./Icon.types";

/** iOS icon: the SF Symbol half of `TIconName`. See `Icon.tsx` for the rest. */
export function Icon({ sf, size, color }: TIconProps) {
  const theme = useTheme();

  return (
    <SymbolView
      name={sf}
      size={size ?? theme.icons.md}
      tintColor={color ?? theme.colors.text}
    />
  );
}
