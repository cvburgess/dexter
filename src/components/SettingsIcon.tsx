import Ionicons from "@react-native-vector-icons/ionicons";
import { ComponentProps } from "react";

export type TSettingsIconName = ComponentProps<typeof Ionicons>["name"];

type TSettingsIconProps = {
  name: TSettingsIconName;
  size: number;
  color: string;
};

// Ionicons renders identically on native and web (unlike Apple-only SF
// Symbols), so settings icons stay consistent across platforms.
export function SettingsIcon({ name, size, color }: TSettingsIconProps) {
  return <Ionicons name={name} size={size} color={color} />;
}
