import { MenuView } from "@expo/ui/community/menu";
import { Platform } from "react-native";

import type { IconMenuProps, TIconMenuOption } from "./IconMenu.types";

/**
 * The `@expo/ui` menu-item `state` for an option. On iOS the SF Symbol is only
 * tinted through SwiftUI's `.tint`, which `@expo/ui` applies to **Toggle**
 * items (any `state`) — a plain **Button** uses `.foregroundColor`, which the
 * system menu ignores for menu content (verified on iOS 26). So a *colored*
 * action item (has `iconColor`, isn't checkable) is given an `"off"` state on
 * iOS: an off toggle shows no checkmark, but it renders through the Toggle path
 * so the tint actually lands. Checkable options map their `isSelected`
 * straight through; everything else stays a plain Button. Android colors the
 * label via `titleColor` and needs no trick.
 */
function menuItemState(option: TIconMenuOption): "on" | "off" | undefined {
  if (option.isSelected !== undefined) return option.isSelected ? "on" : "off";
  if (Platform.OS === "ios" && option.iconColor !== undefined) return "off";
  return undefined;
}

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
          // Android label color. iOS ignores it (its menu label can't be
          // recolored independently); see `menuItemState` for how iOS tints the
          // icon instead.
          titleColor: option.titleColor,
          state: menuItemState(option),
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
