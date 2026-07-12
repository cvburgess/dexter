import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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

import { useTheme } from "@/utils/theme";

import { TNoteEditorProps } from "./NoteEditor.types";

/**
 * Native markdown editor backed by `react-native-enriched-markdown`'s
 * `EnrichedMarkdownTextInput` (a Fabric/New-Architecture native view). The
 * editor is uncontrolled — seeded once via `defaultValue` and reporting edits
 * through `onChangeMarkdown` — so we never feed React state back per keystroke
 * (which would fight the caret). Re-seeding on a date change is handled by the
 * consumer remounting this component with a new `key`.
 *
 * While editing, a keyboard accessory bar rides the top edge of the keyboard. It
 * carries inline-format toggles (bold / italic / underline / strikethrough) and
 * a "Done" button. The native input isn't RN's `TextInput`, so it can't drive an
 * `InputAccessoryView` (no `inputAccessoryViewID`) and `Keyboard.dismiss()` is a
 * no-op on it — both formatting and dismissal go through the component's ref
 * (`toggleBold()` etc., `blur()`). Toggles apply to the current selection, or arm
 * the style for the next characters typed when there's just a caret. Button
 * highlight state comes from the input's `onChangeState` callback. The bar is
 * positioned via reanimated's `useAnimatedKeyboard`. Only inline styles are
 * supported by the input — block elements (headings, lists, quotes, code) are a
 * library limitation, so there are no controls for them.
 */

/** Inline-format toggles shown in the accessory bar, left to right. */
const FORMAT_CONTROLS: {
  key: keyof StyleState;
  symbol: SymbolViewProps["name"];
  label: string;
  toggle: (input: EnrichedMarkdownTextInputInstance) => void;
}[] = [
  { key: "bold", symbol: "bold", label: "Bold", toggle: (i) => i.toggleBold() },
  {
    key: "italic",
    symbol: "italic",
    label: "Italic",
    toggle: (i) => i.toggleItalic(),
  },
  {
    key: "underline",
    symbol: "underline",
    label: "Underline",
    toggle: (i) => i.toggleUnderline(),
  },
  {
    key: "strikethrough",
    symbol: "strikethrough",
    label: "Strikethrough",
    toggle: (i) => i.toggleStrikethrough(),
  },
];

export function NoteEditor({
  initialValue,
  onChangeMarkdown,
  placeholder,
  autoFocus,
  testID,
}: TNoteEditorProps) {
  const theme = useTheme();
  const keyboard = useAnimatedKeyboard();
  const inputRef = useRef<EnrichedMarkdownTextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  const [state, setState] = useState<StyleState | null>(null);

  // Ride the top edge of the keyboard as it animates in/out (UI thread).
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboard.height.value }],
  }));

  return (
    <View style={styles.container}>
      <EnrichedMarkdownTextInput
        ref={inputRef}
        autoFocus={autoFocus}
        cursorColor={theme.colors.primary}
        defaultValue={initialValue}
        multiline
        onBlur={() => setFocused(false)}
        onChangeMarkdown={onChangeMarkdown}
        onChangeState={setState}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        selectionColor={theme.colors.primary}
        style={StyleSheet.flatten([
          styles.editor,
          { color: theme.colors.text },
        ])}
        testID={testID}
      />
      {focused && (
        <Animated.View
          style={[
            styles.accessory,
            barStyle,
            {
              backgroundColor: theme.colors.card,
              borderTopColor: theme.colors.textSecondary,
            },
          ]}
        >
          <View style={styles.tools}>
            {FORMAT_CONTROLS.map((control) => {
              const active = state?.[control.key].isActive ?? false;
              return (
                <Pressable
                  key={control.key}
                  accessibilityLabel={control.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  hitSlop={8}
                  onPress={() => {
                    if (inputRef.current) control.toggle(inputRef.current);
                  }}
                  style={styles.tool}
                >
                  <SymbolView
                    name={control.symbol}
                    size={20}
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
            hitSlop={8}
            onPress={() => inputRef.current?.blur()}
          >
            <Text style={[styles.doneLabel, { color: theme.colors.primary }]}>
              Done
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  editor: {
    flex: 1,
    fontSize: 16,
    padding: 16,
  },
  accessory: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    flexDirection: "row",
    height: 44,
    justifyContent: "space-between",
    left: 0,
    paddingHorizontal: 16,
    position: "absolute",
    right: 0,
  },
  tools: {
    alignItems: "center",
    flexDirection: "row",
    gap: 20,
  },
  tool: {
    alignItems: "center",
    justifyContent: "center",
  },
  doneLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
});
