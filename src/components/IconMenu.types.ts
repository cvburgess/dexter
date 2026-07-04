import type { ReactNode } from "react";

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
  /** Title shown at the top of the menu (iOS only). */
  menuTitle: string;
  /** Accessibility label for the trigger. */
  accessibilityLabel: string;
  sections: TIconMenuSection[];
  /** Trigger content, e.g. a glyph inside a round button. */
  children: ReactNode;
}
