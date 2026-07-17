import { SymbolView } from "expo-symbols";
import { type MouseEvent, useState } from "react";
import {
  Dimensions,
  type GestureResponderEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useTheme, withOpacity } from "@/utils/theme";

import type {
  IconMenuProps,
  TIconMenuOption,
  TIconMenuSection,
} from "./IconMenu.types";

const MENU_WIDTH = 220;
const MENU_MARGIN = 8;

/**
 * Web fallback for `IconMenu`: `@expo/ui`'s `MenuView` doesn't fire actions on
 * web, so a click (or long-press, per `trigger`) on the trigger opens this
 * modal, anchored near the cursor, with the same sections/options as the
 * native menu. A plain section is always visible; a section with `isSubmenu`
 * collapses behind a tappable header row that expands it, one at a time.
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
  // Divider tint derived from the text color so it reads on both schemes,
  // rather than a fixed gray that washes out on dark backgrounds.
  const dividerBorder = {
    borderTopColor: withOpacity(theme.colors.text, 0.15),
  };
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const isLongPress = trigger === "longPress";

  const openAt = (x: number, y: number) => {
    const { width } = Dimensions.get("window");
    setAnchor({
      x: Math.max(MENU_MARGIN, Math.min(x, width - MENU_WIDTH - MENU_MARGIN)),
      y: y + MENU_MARGIN,
    });
  };

  // Explicit `titleColor` override, else destructive red, else default text —
  // shared by the leaf and submenu option rows so their label color can't drift.
  const labelColor = (option: TIconMenuOption) =>
    option.titleColor ??
    (option.isDestructive ? theme.colors.error : theme.colors.text);

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

  const close = () => {
    setAnchor(null);
    setExpandedSection(null);
  };

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
        <Modal visible transparent animationType="fade" onRequestClose={close}>
          <Pressable style={styles.overlay} onPress={close}>
            <ScrollView
              style={[
                styles.menu,
                {
                  backgroundColor: theme.colors.card,
                  borderRadius: theme.borderRadius,
                  position: "absolute",
                  top: anchor.y,
                  left: anchor.x,
                },
              ]}
              contentContainerStyle={styles.menuContent}
            >
              {menuTitle ? (
                <Text
                  style={[
                    styles.menuTitle,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {menuTitle}
                </Text>
              ) : null}
              {sections.map((section, sectionIndex) => {
                const key = sectionKey(section, sectionIndex);

                if (!section.isSubmenu) {
                  return (
                    <View
                      key={key}
                      style={
                        sectionIndex > 0
                          ? [styles.sectionDivider, dividerBorder]
                          : undefined
                      }
                    >
                      {section.title ? (
                        <Text
                          style={[
                            styles.sectionTitle,
                            { color: theme.colors.textSecondary },
                          ]}
                        >
                          {section.title}
                        </Text>
                      ) : null}
                      {section.options.map((option) => (
                        <Pressable
                          key={option.id}
                          style={styles.option}
                          onPress={() => {
                            close();
                            option.onSelect();
                          }}
                        >
                          <Text style={styles.checkmark}>
                            {option.isSelected ? "✓" : ""}
                          </Text>
                          {option.icon ? (
                            <SymbolView
                              name={option.icon}
                              size={18}
                              tintColor={option.iconColor ?? theme.colors.text}
                            />
                          ) : null}
                          <Text style={{ color: labelColor(option) }}>
                            {option.title}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  );
                }

                const expanded = expandedSection === key;
                return (
                  <View
                    key={key}
                    style={
                      sectionIndex > 0
                        ? [styles.sectionDivider, dividerBorder]
                        : undefined
                    }
                  >
                    <Pressable
                      style={styles.option}
                      onPress={() => setExpandedSection(expanded ? null : key)}
                    >
                      {section.icon ? (
                        <SymbolView
                          name={section.icon}
                          size={18}
                          tintColor={theme.colors.text}
                        />
                      ) : null}
                      <Text style={{ color: theme.colors.text }}>
                        {section.title}
                      </Text>
                      <Text
                        style={[
                          styles.chevron,
                          { color: theme.colors.textSecondary },
                        ]}
                      >
                        {expanded ? "⌄" : "›"}
                      </Text>
                    </Pressable>
                    {expanded
                      ? section.options.map((option) => (
                          <Pressable
                            key={option.id}
                            style={[styles.option, styles.optionIndented]}
                            onPress={() => {
                              close();
                              option.onSelect();
                            }}
                          >
                            <Text style={styles.checkmark}>
                              {option.isSelected ? "✓" : ""}
                            </Text>
                            {option.icon ? (
                              <SymbolView
                                name={option.icon}
                                size={18}
                                tintColor={
                                  option.iconColor ?? theme.colors.text
                                }
                              />
                            ) : null}
                            <Text style={{ color: labelColor(option) }}>
                              {option.title}
                            </Text>
                          </Pressable>
                        ))
                      : null}
                  </View>
                );
              })}
            </ScrollView>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
  },
  menu: {
    minWidth: MENU_WIDTH,
    maxHeight: 320,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.25)",
    elevation: 5,
  },
  menuContent: {
    paddingVertical: 8,
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  sectionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
    paddingTop: 4,
  },
  chevron: {
    fontSize: 14,
    marginLeft: "auto",
    paddingRight: 16,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  optionIndented: {
    paddingLeft: 28,
  },
  checkmark: {
    width: 16,
  },
});
