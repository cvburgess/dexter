import { useState } from "react";
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

import { useTheme } from "@/utils/theme";

import type { IconMenuProps } from "./IconMenu.types";

const MENU_WIDTH = 220;
const MENU_MARGIN = 8;

/**
 * Web fallback for `IconMenu`: `@expo/ui`'s `MenuView` doesn't fire actions on
 * web, so a click on the trigger opens this modal, anchored near the cursor,
 * with the same sections/options as the native menu.
 */
export function IconMenu({
  menuTitle,
  accessibilityLabel,
  sections,
  children,
}: IconMenuProps) {
  const theme = useTheme();
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const handlePress = (event: GestureResponderEvent) => {
    const { clientX, clientY } = event.nativeEvent as unknown as {
      clientX?: number;
      clientY?: number;
    };
    const { width } = Dimensions.get("window");
    setAnchor({
      x: Math.max(
        MENU_MARGIN,
        Math.min(clientX ?? 0, width - MENU_WIDTH - MENU_MARGIN),
      ),
      y: (clientY ?? 0) + MENU_MARGIN,
    });
  };

  const close = () => setAnchor(null);

  return (
    <>
      <Pressable accessibilityLabel={accessibilityLabel} onPress={handlePress}>
        {children}
      </Pressable>
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
              {sections.map((section, sectionIndex) => (
                <View
                  key={section.title ?? sectionIndex}
                  style={sectionIndex > 0 ? styles.sectionDivider : undefined}
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
                      <Text
                        style={{
                          color: option.isDestructive
                            ? theme.colors.error
                            : theme.colors.text,
                        }}
                      >
                        {option.title}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ))}
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
  sectionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128, 128, 128, 0.3)",
    marginTop: 4,
    paddingTop: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  checkmark: {
    width: 16,
  },
});
