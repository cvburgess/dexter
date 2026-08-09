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

// The menu's own dimensions: a popover is sized to hold labels comfortably and
// to stop short of the viewport edge, which is not a question the spacing scale
// answers. Its insets and type *are* tokenized. `MENU_WIDTH` is a floor, not a
// width — a long option label grows the menu past it, which is why the
// viewport clamp measures rather than assumes.
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

/**
 * Web fallback for `IconMenu`: `@expo/ui`'s `MenuView` doesn't fire actions on
 * web, so a click (or long-press, per `trigger`) on the trigger opens this
 * popover, anchored near the cursor, with the same sections/options as the
 * native menu. A plain section is always visible; a section with `isSubmenu`
 * collapses behind a tappable header row that expands it, one at a time.
 *
 * It renders through `components/WebOverlay.web.tsx`, not React Native's
 * `Modal`. `Modal` portals into `document.body` and sets no `pointer-events` of
 * its own, so it inherits the `none` a Radix dismissable layer puts on the body
 * — which made the menu unclickable everywhere it is reached from inside a
 * modal screen (`SubtaskRow` renders one inside `TaskForm`) or from the page
 * under an open drawer. See `WebOverlay`'s docstring for the mechanism.
 */
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
  // The menu's rendered box. It is only as wide as its longest label
  // (`minWidth`, not `width`) and only as tall as its options, so neither
  // dimension is known until it has laid out — and a submenu expanding changes
  // the height again while it is open.
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const isLongPress = trigger === "longPress";

  // The chosen option's action, parked until the menu has actually closed.
  //
  // This started as a workaround for `Modal`, which restored focus to whatever
  // was focused before it opened, from its own unmount cleanup. An action run
  // inline was still inside that commit, so one that starts an inline edit —
  // "Add subtask", which mounts an autoFocus input — had its focus taken
  // straight back; the input then blurred, which commits an empty title and
  // drops the row, and the menu item looked like it did nothing at all
  // (DEX-70). `WebOverlay` restores no focus, so that particular theft is gone
  // with `Modal`.
  //
  // The ordering it forced is still the contract, and still load-bearing: the
  // option row is a `Pressable` and holds focus when it is pressed, so an
  // action that focuses something of its own has to run after the row is gone.
  // An effect on the close is exactly that point — React flushes every unmount
  // effect in a commit before any mount effect — so whatever the action focuses
  // next keeps it.
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

  /**
   * The cursor point pulled back far enough to keep the whole menu on screen.
   *
   * Measured, not assumed: clamping `x` against `MENU_WIDTH` let a menu with a
   * long option label — which grows past that `minWidth` — hang off the right
   * edge, and nothing clamped `y` at all, so a menu opened near the bottom of
   * the viewport ran off it entirely.
   *
   * Until the layout pass lands the raw point is used, so a menu is never
   * withheld waiting on a measurement. That costs nothing in the common case:
   * a menu that already fits clamps to the same place it was drawn.
   */
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

  // Right-click is the mouse equivalent of a long-press, so it opens long-press
  // menus at the cursor and suppresses the browser's native context menu. Tap
  // menus are left alone (the handler is only wired for `trigger === "longPress"`).
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

  // `Modal` gave Escape-to-dismiss for free (react-native-web closes it from a
  // document `keyup`); keep it now that it's gone, the same way
  // `ConfirmationModal.web.tsx` does. Guarded because this file is also
  // imported directly by its unit test, which runs under the React Native
  // environment where `window` is a stub with no DOM events.
  //
  // Inside a modal screen the dialog's own Escape handler is a `keydown`
  // registered in capture on the document, so it still runs first and closes
  // the screen — unchanged from what `Modal` did here.
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
      {/*
        A layout-neutral DOM wrapper (adds no box) catches right-clicks so
        long-press menus are reachable with a mouse. `contextmenu` bubbles up
        from the trigger content; tap menus opt out by omitting the handler.
      */}
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
          {/*
            Invisible, not a scrim: an OS context menu floats over untouched
            content, so the full-viewport layer is only here to catch the click
            that dismisses it — the same job `DateField.web.tsx`'s catcher does.
            Separation is the menu's own hairline and shadow instead (DEX-125).

            A sibling *behind* the menu, not its parent, for the same reason
            `DateField.web.tsx` renders its catcher as one: a press on the
            menu's own chrome — the title, a section heading, the container's
            vertical padding — has no responder of its own, so nesting let it
            bubble to this handler and dismiss the menu instead of doing
            nothing. `ConfirmationModal.web.tsx` guards the same shape with a
            `stopPropagation`, which is unavailable here because the overlay is
            a `Pressable`, not a DOM `onClick`.

            `absoluteFill` resolves against `WebOverlay`'s own root, which is
            the viewport — there is no `Modal` content view in between any more,
            and a react-native-web `View` wrapper would only reintroduce one
            (its default `position: relative` plus an auto height would collapse
            this to nothing).
          */}
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
                // Without a wash behind it the fill can't mark where the menu
                // ends — it sits on cards and rows that are `surfaceSunken`
                // too — so the edge has to be drawn.
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

  // The checkmark column is reserved per section, not per row, so a group whose
  // options are checkable stays aligned even while none of them is checked. A
  // group of plain actions reserves nothing and lines up with the submenu
  // headers instead of sitting indented under them.
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
      // The checkmark column is itself the indent — it sits where the parent
      // row's icon does, so a submenu's rows line up under their header. Only a
      // submenu with nothing to check needs an indent of its own.
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
