import type { TIconName } from "./Icon.types";

export type TGlassIconButtonProps = {
  /** SF Symbol shown on iOS. */
  sfSymbol: TIconName["sf"];
  /** Ionicons name shown on Android/web (SF Symbols don't render there). */
  ionicon: TIconName["ionicon"];
  accessibilityLabel: string;
  /** Diameter of the circular button. Defaults to `theme.controls.md`. */
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
  /**
   * Shows a small warning-yellow attention dot in the top-right corner when
   * true — signals that action is waiting behind this button (DEX-58, the
   * Backlog's overdue/left-behind indicator).
   */
  indicator?: boolean;
  /**
   * Draws the plain bordered circle on iOS even where liquid glass is
   * available — the same shape the pre-26 fallback uses.
   *
   * **For a button under an animated opacity.** Liquid glass is a
   * `UIVisualEffectView` sampling what is behind it, and it cannot do that
   * through a non-opaque ancestor layer: inside a ritual step, where
   * `SwipeablePage` fades the whole page in on every swipe, the circle washes
   * out to nothing and the icon reads as a bare glyph floating beside the card.
   * Off iOS this changes nothing — that branch already draws this circle.
   *
   * A flag rather than a fix in `SwipeablePage`, because the fade is the
   * ritual's whole arrival and the buttons are the part that has to stay legible
   * mid-animation, not the other way round.
   */
  solid?: boolean;
};
