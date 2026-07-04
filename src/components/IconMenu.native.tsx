import { MenuView } from "@expo/ui/community/menu";

import type { IconMenuProps, TIconMenuOption } from "./IconMenu.types";

/**
 * Tap-to-open icon menu backed by `@expo/ui`'s community `MenuView`
 * (`shouldOpenOnLongPress={false}`: a SwiftUI `Menu` on iOS, an anchored
 * Compose `DropdownMenu` on Android). A plain section renders as an inline
 * group (always visible, with a divider between groups); a section with
 * `isSubmenu` renders as a nested submenu that expands on tap.
 */
export function IconMenu({
  menuTitle,
  accessibilityLabel,
  sections,
  children,
}: IconMenuProps) {
  const optionsById = new Map<string, TIconMenuOption>();
  for (const section of sections) {
    for (const option of section.options) optionsById.set(option.id, option);
  }

  return (
    <MenuView
      title={menuTitle}
      testID={accessibilityLabel}
      shouldOpenOnLongPress={false}
      actions={sections.map((section, index) => ({
        id: `section-${index}`,
        title: section.title ?? "",
        displayInline: !section.isSubmenu,
        subactions: section.options.map((option) => ({
          id: option.id,
          title: option.title,
          state: option.isSelected ? "on" : "off",
          attributes: option.isDestructive ? { destructive: true } : undefined,
        })),
      }))}
      onPressAction={({ nativeEvent }) => {
        optionsById.get(nativeEvent.event)?.onSelect();
      }}
    >
      {children}
    </MenuView>
  );
}
