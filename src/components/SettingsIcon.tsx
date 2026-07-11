import Ionicons from "@react-native-vector-icons/ionicons";
import { ComponentProps } from "react";

export type TSettingsIconName = ComponentProps<typeof Ionicons>["name"];

type TSettingsIconProps = {
  name: TSettingsIconName;
  size: number;
  color: string;
};

/**
 * The icon used throughout settings. Ionicons renders identically on native and
 * web, so settings icons stay consistent across platforms (unlike SF Symbols,
 * which are Apple-only). Shared by SettingsRow and SettingsSidebar.
 */
export function SettingsIcon({ name, size, color }: TSettingsIconProps) {
  return <Ionicons name={name} size={size} color={color} />;
}
