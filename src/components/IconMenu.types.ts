import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

/** A single selectable row in an `IconMenu` section. */
export type TIconMenuOption = {
  id: string;
  title: string;
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
