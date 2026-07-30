import type Ionicons from "@react-native-vector-icons/ionicons";
import type { SymbolViewProps } from "expo-symbols";
import type { ComponentProps } from "react";

/**
 * One glyph, named once per icon set: an SF Symbol for iOS and an Ionicon for
 * everywhere else.
 *
 * Both names are required. `expo-symbols` accepts an `{ ios, android, web }`
 * name object and falls back to Google's Material Symbols off iOS, which is how
 * the app ended up rendering two different icon sets depending on the platform
 * (DEX-61). Naming the Ionicon explicitly is what keeps web and Android on
 * Dexter's own set.
 */
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
