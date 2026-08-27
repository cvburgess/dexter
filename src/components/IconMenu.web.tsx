import {
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  type GestureResponderEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SHADOW_LG, Theme, useTheme } from "@/utils/theme";

import { Icon } from "./Icon";
import type {
  IconMenuProps,
  TIconMenuOption,
  TIconMenuSection,
} from "./IconMenu.types";
import { WebOverlay } from "./WebOverlay.web";

// MENU_WIDTH is a floor, not a width — a long label grows the menu past it,
// which is why the viewport clamp below measures rather than assumes.
const MENU_WIDTH = 220;
const MENU_MARGIN = 8;
const MENU_MAX_HEIGHT = 320;

// Explicit `titleColor` override, else destructive red, else default text —
// shared by the leaf and submenu option rows so their label color can't drift.
const labelColor = (
  option: TIconMenuOption,
  theme: ReturnType<typeof useTheme>,
) =>
  option.titleColor ??
  (option.isDestructive ? theme.colors.error : theme.colors.text);

// Web fallback: @expo/ui's MenuView doesn't fire actions on web, so this
// popover renders through WebOverlay.web.tsx, not Modal (Radix pointer-events).
export function IconMenu({
  menuTitle,
  accessibilityLabel,
  trigger = "tap",
  sections,
  children,
  style,
}: IconMenuProps) {
  const theme = useTheme();
  const dividerBorderColor = theme.colors.border;
  const [anchor, setAnchor] = useState<{
    x: number;
    y: number;
    viewportWidth: number;
    viewportHeight: number;
  } | null>(null);
  // Neither dimension is known until layout (minWidth, not width); a
  // submenu expanding changes height again while open.
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const isLongPress = trigger === "longPress";

  // Parked until the menu closes (DEX-70) — an action focusing its own input
  // must run after the row unmounts, or the new focus is stolen back.
  const pending = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (anchor !== null) return;
    const action = pending.current;
    pending.current = null;
    action?.();
  }, [anchor]);

  const openAt = (x: number, y: number) => {
    const { width, height } = Dimensions.get("window");
    setSize(null);
    setAnchor({
      x,
      y: y + MENU_MARGIN,
      viewportWidth: width,
      viewportHeight: height,
    });
  };

  // Measured, not assumed — clamping x against MENU_WIDTH let a longer label
  // hang off the edge. The raw point is used until layout lands.
  const position = (() => {
    if (!anchor) return null;
    if (!size) return { left: anchor.x, top: anchor.y };
    const furthest = (point: number, extent: number, viewport: number) =>
      Math.max(MENU_MARGIN, Math.min(point, viewport - extent - MENU_MARGIN));
    return {
      left: furthest(anchor.x, size.width, anchor.viewportWidth),
      top: furthest(anchor.y, size.height, anchor.viewportHeight),
    };
  })();

  const handlePress = (event: GestureResponderEvent) => {
    // Web (DOM) events carry clientX/clientY; native touches carry pageX/pageY.
    const { pageX, pageY, clientX, clientY } = event.nativeEvent as {
      pageX?: number;
      pageY?: number;
      clientX?: number;
      clientY?: number;
    };
    openAt(clientX ?? pageX ?? 0, clientY ?? pageY ?? 0);
  };

  // Right-click is the mouse equivalent of long-press; tap menus are left alone.
  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    openAt(event.clientX, event.clientY);
  };

  // Stable, so the Escape listener below rebinds on the open/closed transition
  // alone rather than on every render.
  const close = useCallback(() => {
    setAnchor(null);
    setSize(null);
    setExpandedSection(null);
  }, []);

  // Escape-to-dismiss, same as ConfirmationModal.web.tsx — Modal gave this
  // for free. Guarded since the unit test runs under RN, where window is a stub.
  useEffect(() => {
    if (anchor === null || typeof window?.addEventListener !== "function") {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [anchor, close]);

  const sectionKey = (section: TIconMenuSection, index: number) =>
    section.title ?? `${index}`;

  return (
    <>
      {/* Layout-neutral wrapper catches right-clicks for mouse users. */}
      <div
        style={{ display: "contents" }}
        onContextMenu={isLongPress ? handleContextMenu : undefined}
      >
        <Pressable
          accessibilityLabel={accessibilityLabel}
          style={style}
          {...(isLongPress
            ? { onLongPress: handlePress }
            : { onPress: handlePress })}
        >
          {children}
        </Pressable>
      </div>
      {anchor ? (
        <WebOverlay>
          {/* Invisible, not a scrim (DEX-125); a sibling behind the menu so
              a press on the menu's own chrome doesn't bubble and dismiss it. */}
          <Pressable
            testID="menu-overlay"
            style={StyleSheet.absoluteFill}
            onPress={close}
          />
          <ScrollView
            // Same box, same object — a reposition re-fires layout without
            // resizing anything, and a new object every time would loop.
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setSize((current) =>
                current?.width === width && current?.height === height
                  ? current
                  : { width, height },
              );
            }}
            style={[
              styles.menu,
              {
                backgroundColor: theme.colors.surfaceSunken,
                // The edge is drawn because rows beneath are surfaceSunken too.
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
                borderWidth: StyleSheet.hairlineWidth,
                boxShadow: SHADOW_LG,
                position: "absolute",
                top: position?.top,
                left: position?.left,
              },
            ]}
            contentContainerStyle={{ paddingVertical: theme.space.sm }}
          >
            {menuTitle ? (
              <Text style={[theme.fonts.title, sectionTitleStyle(theme)]}>
                {menuTitle}
              </Text>
            ) : null}
            {sections.map((section, sectionIndex) => {
              const key = sectionKey(section, sectionIndex);
              return (
                <MenuSection
                  key={key}
                  section={section}
                  dividerBorderColor={
                    sectionIndex > 0 && !section.hideDivider
                      ? dividerBorderColor
                      : null
                  }
                  expanded={expandedSection === key}
                  onToggleExpanded={() =>
                    setExpandedSection(expandedSection === key ? null : key)
                  }
                  theme={theme}
                  onSelectOption={(option) => {
                    // Parked, not called: see `pending` above.
                    pending.current = option.onSelect;
                    close();
                  }}
                />
              );
            })}
          </ScrollView>
        </WebOverlay>
      ) : null}
    </>
  );
}

// Sizes that vary by density can't live in `StyleSheet.create`, so the rules
// shared between the section header and its rows are built per theme instead.
const sectionTitleStyle = (theme: Theme) => ({
  color: theme.colors.textSecondary,
  paddingHorizontal: theme.space.md,
  paddingVertical: theme.space.xs,
});

const optionRowStyle = (theme: Theme) => ({
  gap: theme.space.sm,
  paddingHorizontal: theme.space.md,
  paddingVertical: theme.space.sm,
});

function MenuSection({
  section,
  dividerBorderColor,
  expanded,
  onToggleExpanded,
  theme,
  onSelectOption,
}: {
  section: TIconMenuSection;
  /** Divider color for every section but the first, or `null` to omit it. */
  dividerBorderColor: string | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  theme: Theme;
  onSelectOption: (option: TIconMenuOption) => void;
}) {
  const dividerStyle =
    dividerBorderColor !== null
      ? [
          styles.sectionDivider,
          {
            borderTopColor: dividerBorderColor,
            marginTop: theme.space.xs,
            paddingTop: theme.space.xs,
          },
        ]
      : undefined;

  // Reserved per section, not per row, so a checkable group stays aligned
  // even when nothing is checked.
  const showCheckmark = section.options.some(
    (option) => option.isSelected !== undefined,
  );

  if (!section.isSubmenu) {
    return (
      <View style={dividerStyle}>
        {section.title ? (
          <Text style={[theme.fonts.title, sectionTitleStyle(theme)]}>
            {section.title}
          </Text>
        ) : null}
        {section.options.map((option) => (
          <MenuOptionRow
            key={option.id}
            option={option}
            showCheckmark={showCheckmark}
            theme={theme}
            onSelect={() => onSelectOption(option)}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={dividerStyle}>
      <Pressable
        style={[styles.option, optionRowStyle(theme)]}
        onPress={onToggleExpanded}
      >
        {section.icon ? <Icon {...section.icon} /> : null}
        <Text style={[theme.fonts.body, { color: theme.colors.text }]}>
          {section.title}
        </Text>
        <Text
          style={[
            theme.fonts.body,
            styles.chevron,
            { color: theme.colors.textSecondary },
          ]}
        >
          {expanded ? "⌄" : "›"}
        </Text>
      </Pressable>
      {expanded
        ? section.options.map((option) => (
            <MenuOptionRow
              key={option.id}
              option={option}
              indented
              showCheckmark={showCheckmark}
              theme={theme}
              onSelect={() => onSelectOption(option)}
            />
          ))
        : null}
    </View>
  );
}

function MenuOptionRow({
  option,
  indented,
  showCheckmark,
  theme,
  onSelect,
}: {
  option: TIconMenuOption;
  indented?: boolean;
  /** Whether to reserve the leading checkmark column; see `MenuSection`. */
  showCheckmark?: boolean;
  theme: Theme;
  onSelect: () => void;
}) {
  return (
    <Pressable
      // The checkmark column is itself the indent — a submenu with nothing to
      // check needs its own.
      style={[
        styles.option,
        optionRowStyle(theme),
        indented &&
          !showCheckmark && {
            paddingLeft: theme.space.md + theme.space.sm,
          },
      ]}
      onPress={onSelect}
    >
      {showCheckmark ? (
        // As wide as the icons above it, so a checked row's label starts where
        // its parent's does.
        <Text style={{ width: theme.icons.md }}>
          {option.isSelected ? "✓" : ""}
        </Text>
      ) : null}
      {option.icon ? <Icon {...option.icon} color={option.iconColor} /> : null}
      <Text style={[theme.fonts.body, { color: labelColor(option, theme) }]}>
        {option.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  menu: {
    minWidth: MENU_WIDTH,
    maxHeight: MENU_MAX_HEIGHT,
    elevation: 5,
  },
  sectionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  chevron: {
    // Pushed to the far end of the row, whose own horizontal padding is the
    // only inset it needs — its own would double the gap the labels get.
    marginLeft: "auto",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
  },
});
