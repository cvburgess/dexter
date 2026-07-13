import Ionicons from "@react-native-vector-icons/ionicons";
import type { SymbolViewProps } from "expo-symbols";
import type { ComponentProps } from "react";

export type TGlassIconButtonProps = {
  /** SF Symbol shown on iOS. */
  sfSymbol: SymbolViewProps["name"];
  /** Ionicons name shown on Android/web (SF Symbols don't render there). */
  ionicon: ComponentProps<typeof Ionicons>["name"];
  accessibilityLabel: string;
  /** Diameter of the circular button (default 40). */
  size?: number;
  /**
   * Optional press handler. Omit when used purely as an `IconMenu` trigger —
   * the menu handles the tap and the button is just the (visual) anchor.
   */
  onPress?: () => void;
  /**
   * Tints the icon `theme.colors.primary` when true, `theme.colors.text` when
   * false — for buttons that toggle a state on/off. Omit to keep each
   * platform's default icon color (primary on iOS, text on Android/web).
   */
  active?: boolean;
};
