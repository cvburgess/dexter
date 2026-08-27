import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import type { TIconName } from "./Icon.types";

/** A single selectable row in an `IconMenu` section. */
export type TIconMenuOption = {
  id: string;
  title: string;
  /** Icon rendered beside the label. */
  icon?: TIconName;
  /** Icon tint, all platforms — needs @expo/ui >= 57.0.8 on iOS. */
  iconColor?: string;
  /** Label tint, Android/web only — iOS labels can't be recolored independently. */
  titleColor?: string;
  isSelected?: boolean;
  isDestructive?: boolean;
  onSelect: () => void;
};

// Default: an inline section (native) / divided group (web), always visible.
// isSubmenu: true renders a collapsed submenu that expands on tap.
export type TIconMenuSection = {
  title?: string;
  /** Icon rendered beside the section title. */
  icon?: TIconName;
  isSubmenu?: boolean;
  /** Continues the section above instead of a group of its own; on native
   * also flattens a plain section into bare top-level actions. */
  hideDivider?: boolean;
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
