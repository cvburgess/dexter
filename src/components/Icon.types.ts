import type Ionicons from "@react-native-vector-icons/ionicons";
import type { SymbolViewProps } from "expo-symbols";
import type { ComponentProps } from "react";

/** One glyph named for both sets: `expo-symbols` falls back to Google's
 * Material Symbols off iOS, so naming the Ionicon explicitly keeps web/Android on Dexter's own set (DEX-61). */
export type TIconName = {
  /** SF Symbol name, rendered on iOS. */
  sf: Exclude<SymbolViewProps["name"], object>;
  /** Ionicons name, rendered on Android and web. */
  ionicon: ComponentProps<typeof Ionicons>["name"];
};

export type TIconProps = TIconName & {
  /** Glyph size. Defaults to `theme.icons.md`. */
  size?: number;
  /** Glyph color. Defaults to `theme.colors.text`. */
  color?: string;
};
