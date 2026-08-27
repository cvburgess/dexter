import type { TIconName } from "./Icon.types";

export type TGlassIconButtonProps = {
  /** SF Symbol shown on iOS. */
  sfSymbol: TIconName["sf"];
  /** Ionicons name shown on Android/web (SF Symbols don't render there). */
  ionicon: TIconName["ionicon"];
  accessibilityLabel: string;
  /** Diameter of the circular button. Defaults to `theme.controls.md`. */
  size?: number;
  /** Omit when used purely as an `IconMenu` trigger — the menu handles the
   * tap and the button is just the visual anchor. */
  onPress?: () => void;
  /** Tints `primary` when true, `text` when false; omit for the platform default. */
  active?: boolean;
  /** Shows a warning-yellow attention dot (DEX-58, Backlog's indicator). */
  indicator?: boolean;
  /** Forces the plain bordered circle: liquid glass can't sample through the
   * non-opaque ancestor a fading `SwipeablePage` step puts it under. */
  solid?: boolean;
};
