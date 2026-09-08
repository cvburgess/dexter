import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from "react-native-reanimated";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import {
  EnrichedMarkdownTextInput,
  type EnrichedMarkdownTextInputInstance,
  type StyleState,
} from "react-native-enriched-markdown";

import { markdownInputStyle } from "@/utils/markdownStyle";
import {
  headingLabel,
  isListActive,
  nextHeadingLevel,
} from "@/utils/markdownToolbar";
import { useTheme } from "@/utils/theme";

import { TNoteEditorProps } from "./NoteEditor.types";

// Uncontrolled (defaultValue + onChangeMarkdown) so React never fights the
// caret. The bar carries only what the native format menu can't reach.

// The bar rides the keyboard by transform; the ScrollView's content padding
// is a constant, never keyboard.height — that pairing is the DEX-92 bug.

type TBlockControl = {
  /** Names a Material Symbol directly, not via Icon (DEX-61) — Ionicons has
   * no list or indent glyph to convert to. */
  symbol: SymbolViewProps["name"];
  label: string;
  method:
    "toggleUnorderedList" | "toggleOrderedList" | "indentList" | "outdentList";
  /** `StyleState` key whose `isActive` highlights this control, if any. */
  activeKey?: "unorderedList" | "orderedList";
  /** Indent and outdent are meaningless outside a list. */
  listOnly?: boolean;
};

const BLOCK_CONTROLS: TBlockControl[] = [
  {
    symbol: {
      ios: "list.bullet",
      android: "format_list_bulleted",
      web: "format_list_bulleted",
    },
    label: "Bullet list",
    method: "toggleUnorderedList",
    activeKey: "unorderedList",
  },
  {
    symbol: {
      ios: "list.number",
      android: "format_list_numbered",
      web: "format_list_numbered",
    },
    label: "Numbered list",
    method: "toggleOrderedList",
    activeKey: "orderedList",
  },
  {
    symbol: {
      ios: "decrease.indent",
      android: "format_indent_decrease",
      web: "format_indent_decrease",
    },
    label: "Outdent",
    method: "outdentList",
    listOnly: true,
  },
  {
    symbol: {
      ios: "increase.indent",
      android: "format_indent_increase",
      web: "format_indent_increase",
    },
    label: "Indent",
    method: "indentList",
    listOnly: true,
  },
];

export function NoteEditor({
  initialValue,
  onChangeMarkdown,
  placeholder,
  autoFocus,
  onFocusChange,
  testID,
}: TNoteEditorProps) {
  const theme = useTheme();
  const keyboard = useAnimatedKeyboard();
  const inputRef = useRef<EnrichedMarkdownTextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  const [state, setState] = useState<StyleState | null>(null);
  const inputStyle = useMemo(() => markdownInputStyle(theme), [theme]);

  // Ride the top edge of the keyboard as it animates in/out (UI thread).
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboard.height.value }],
  }));

  // React fires no blur on unmount, which would otherwise leave the host's
  // swipe gesture disabled on the next day.
  useEffect(() => () => onFocusChange?.(false), [onFocusChange]);

  const inList = isListActive(state);
  const controls = BLOCK_CONTROLS.filter((c) => inList || !c.listOnly);

  return (
    <View style={styles.fill}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[
          styles.fill,
          { paddingBottom: focused ? theme.controls.md : 0 },
        ]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        style={styles.fill}
      >
        <EnrichedMarkdownTextInput
          ref={inputRef}
          autoFocus={autoFocus}
          cursorColor={theme.colors.primary}
          defaultValue={initialValue}
          markdownStyle={inputStyle}
          multiline
          onBlur={() => {
            setFocused(false);
            // Clear so a later focus doesn't flash the previous caret's
            // state before the input emits a fresh one.
            setState(null);
            onFocusChange?.(false);
          }}
          onChangeMarkdown={onChangeMarkdown}
          onChangeState={setState}
          onFocus={() => {
            setFocused(true);
            onFocusChange?.(true);
          }}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          selectionColor={theme.colors.primary}
          style={StyleSheet.flatten([
            styles.fill,
            // Body copy, not a heading: the writing surface takes the same role
            // token as the rest of the app's prose.
            theme.fonts.body,
            { color: theme.colors.text, padding: theme.space.md },
          ])}
          testID={testID}
        />
      </ScrollView>
      {focused && (
        <Animated.View
          style={[
            styles.bar,
            barStyle,
            {
              backgroundColor: theme.colors.surfaceSunken,
              borderTopColor: theme.colors.border,
              height: theme.controls.md,
              paddingHorizontal: theme.space.md,
            },
          ]}
        >
          <View style={[styles.tools, { gap: theme.space.lg }]}>
            <Pressable
              accessibilityLabel="Heading"
              accessibilityRole="button"
              accessibilityState={{
                selected: state?.heading.isActive ?? false,
              }}
              hitSlop={theme.space.sm}
              onPress={() =>
                inputRef.current?.toggleHeading(nextHeadingLevel(state))
              }
            >
              <Text
                style={[
                  theme.fonts.control,
                  {
                    color: state?.heading.isActive
                      ? theme.colors.primary
                      : theme.colors.textSecondary,
                  },
                ]}
              >
                {headingLabel(state)}
              </Text>
            </Pressable>
            {controls.map((control) => {
              const active = control.activeKey
                ? (state?.[control.activeKey].isActive ?? false)
                : false;
              return (
                <Pressable
                  key={control.method}
                  accessibilityLabel={control.label}
                  accessibilityRole="button"
                  accessibilityState={
                    control.activeKey ? { selected: active } : undefined
                  }
                  hitSlop={theme.space.sm}
                  onPress={() => inputRef.current?.[control.method]()}
                >
                  <SymbolView
                    name={control.symbol}
                    size={theme.icons.md}
                    tintColor={
                      active ? theme.colors.primary : theme.colors.textSecondary
                    }
                  />
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="button"
            hitSlop={theme.space.sm}
            onPress={() => inputRef.current?.blur()}
          >
            <Text
              style={[theme.fonts.control, { color: theme.colors.primary }]}
            >
              Done
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  bar: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    left: 0,
    position: "absolute",
    right: 0,
  },
  tools: {
    alignItems: "center",
    flexDirection: "row",
  },
});
