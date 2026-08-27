import { MenuView } from "@expo/ui/community/menu";
import type { ComponentProps } from "react";

import { useTheme } from "@/utils/theme";

import type { IconMenuProps, TIconMenuOption } from "./IconMenu.types";

/** One entry in `MenuView`'s action tree — a leaf button or a group of them. */
type TMenuAction = ComponentProps<typeof MenuView>["actions"][number];

// Backed by @expo/ui's MenuView (SwiftUI Menu/ContextMenu on iOS, an
// anchored Compose DropdownMenu on Android).
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
    // MenuView's image takes one string, so Android draws no icon (DEX-61).
    image: option.icon?.sf,
    imageColor: option.iconColor,
    // Android only — iOS colors the icon via imageColor and can't recolor
    // a label independently.
    titleColor: option.titleColor,
    // Only checkable options declare isSelected; omitting state renders a
    // plain button instead of a stateful Toggle.
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
      // Android only — omitting it leaves the Compose menu on the device
      // scheme, wrong whenever the in-app theme disagrees.
      colorScheme={mode}
      shouldOpenOnLongPress={trigger === "longPress"}
      actions={sections.flatMap((section, index): TMenuAction[] =>
        // A continuing plain section is bare top-level actions — an inline
        // group would draw the separator hideDivider asks not to have.
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
