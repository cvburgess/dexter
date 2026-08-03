import { MenuView } from "@expo/ui/community/menu";
import type { ComponentProps } from "react";

import { useTheme } from "@/utils/theme";

import type { IconMenuProps, TIconMenuOption } from "./IconMenu.types";

/** One entry in `MenuView`'s action tree — a leaf button or a group of them. */
type TMenuAction = ComponentProps<typeof MenuView>["actions"][number];

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
  const { mode } = useTheme();

  const optionsById = new Map<string, TIconMenuOption>();
  for (const section of sections) {
    for (const option of section.options) optionsById.set(option.id, option);
  }

  const toAction = (option: TIconMenuOption): TMenuAction => ({
    id: option.id,
    title: option.title,
    // The SF Symbol name. `MenuView`'s `image` takes one string, so Android —
    // which would want a drawable name — draws no icon; that was already true
    // before the Ionicons switch (DEX-61) and is unchanged by it.
    image: option.icon?.sf,
    imageColor: option.iconColor,
    // Android label color. iOS colors the icon from `imageColor` (via the
    // `.tint` fix in @expo/ui 57.0.8) but can't recolor a menu label
    // independently, so this is a no-op there.
    titleColor: option.titleColor,
    // Only checkable options declare `isSelected`. Omitting `state` makes
    // @expo/ui render a plain button rather than a stateful Toggle, so action
    // items (e.g. "Backlog") never stick a checkmark after being tapped.
    state:
      option.isSelected === undefined
        ? undefined
        : option.isSelected
          ? "on"
          : "off",
    attributes: option.isDestructive ? { destructive: true } : undefined,
  });

  return (
    <MenuView
      title={menuTitle || undefined}
      testID={accessibilityLabel}
      style={style}
      // Android only (iOS ignores it). Omitting this leaves the Compose menu
      // following the *device* scheme, which is wrong whenever the user's
      // in-app theme doesn't agree with it — an explicit LIGHT/DARK preference,
      // or a dark palette picked on a light phone. Added in @expo/ui 57.0.8.
      colorScheme={mode}
      shouldOpenOnLongPress={trigger === "longPress"}
      actions={sections.flatMap((section, index): TMenuAction[] =>
        // A plain section that continues the one before it is emitted as bare
        // top-level actions: an inline group of its own would be drawn with the
        // separator that `hideDivider` asks not to have.
        !section.isSubmenu && section.hideDivider
          ? section.options.map(toAction)
          : [
              {
                id: `section-${index}`,
                title: section.title ?? "",
                image: section.icon?.sf,
                displayInline: !section.isSubmenu,
                subactions: section.options.map(toAction),
              },
            ],
      )}
      onPressAction={({ nativeEvent }) => {
        optionsById.get(nativeEvent.event)?.onSelect();
      }}
    >
      {children}
    </MenuView>
  );
}
