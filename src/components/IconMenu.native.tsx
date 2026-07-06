import { MenuView } from "@expo/ui/community/menu";

import type { IconMenuProps, TIconMenuOption } from "./IconMenu.types";

/**
 * Icon menu backed by `@expo/ui`'s community `MenuView` (a SwiftUI `Menu`/
 * `ContextMenu` on iOS, an anchored Compose `DropdownMenu` on Android),
 * opened by a tap or a long-press per `trigger`. A plain section renders as
 * an inline group (always visible, with a divider between groups); a
 * section with `isSubmenu` renders as a nested submenu that expands on tap.
 */
export function IconMenu({
  menuTitle,
  accessibilityLabel,
  trigger = "tap",
  sections,
  children,
  style,
}: IconMenuProps) {
  const optionsById = new Map<string, TIconMenuOption>();
  for (const section of sections) {
    for (const option of section.options) optionsById.set(option.id, option);
  }

  return (
    <MenuView
      title={menuTitle || undefined}
      testID={accessibilityLabel}
      style={style}
      shouldOpenOnLongPress={trigger === "longPress"}
      actions={sections.map((section, index) => ({
        id: `section-${index}`,
        title: section.title ?? "",
        image:
          typeof section.icon === "string" ? section.icon : section.icon?.ios,
        displayInline: !section.isSubmenu,
        subactions: section.options.map((option) => ({
          id: option.id,
          title: option.title,
          image:
            typeof option.icon === "string" ? option.icon : option.icon?.ios,
          imageColor: option.iconColor,
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
