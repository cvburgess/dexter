import type { SymbolViewProps } from "expo-symbols";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

/** A single selectable row in an `IconMenu` section. */
export type TIconMenuOption = {
  id: string;
  title: string;
  /** Icon rendered beside the label (SF Symbol / Material Symbol names). */
  icon?: SymbolViewProps["name"];
  /**
   * Tint for the icon. Applied on all platforms — on iOS the icon is tinted
   * through SwiftUI's `.tint` (see `IconMenu.native`'s `menuItemState`), which
   * colors the SF Symbol but not the label. Set `titleColor` too for the label
   * on Android/web.
   */
  iconColor?: string;
  /**
   * Tint for the label text. Applied on Android and web. iOS menu labels can't
   * be recolored independently (only the icon tints, via `iconColor`), so this
   * is a no-op there.
   */
  titleColor?: string;
  isSelected?: boolean;
  isDestructive?: boolean;
  onSelect: () => void;
};

/**
 * A titled group of options. By default, rendered as an inline section
 * (native) / a divided group (web) — always visible. With `isSubmenu: true`,
 * rendered as a collapsed submenu that expands on tap.
 */
export type TIconMenuSection = {
  title?: string;
  /** Icon rendered beside the section title (SF Symbol / Material Symbol names). */
  icon?: SymbolViewProps["name"];
  isSubmenu?: boolean;
  options: TIconMenuOption[];
};

export interface IconMenuProps {
  /** Title shown at the top of the menu (iOS only). Omit for no title. */
  menuTitle?: string;
  /** Accessibility label for the trigger. */
  accessibilityLabel: string;
  /** Whether a tap or a long-press opens the menu. Defaults to "tap". */
  trigger?: "tap" | "longPress";
  sections: TIconMenuSection[];
  /** Trigger content, e.g. a glyph inside a round button, or a whole row. */
  children: ReactNode;
  /** Style applied to the trigger wrapper. */
  style?: StyleProp<ViewStyle>;
}
