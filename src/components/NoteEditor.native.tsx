import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

/** Height of the accessory bar; also the bottom inset reserved for it. */
const BAR_HEIGHT = 44;

type TFormatControl = {
  /** `StyleState` key whose `isActive` drives this button's highlight. */
  key: keyof StyleState;
  /**
   * SF Symbol (iOS) + Material Symbol (Android) — needs both so the icon renders
   * off iOS: `expo-symbols` yields nothing for a bare string name.
   *
   * The one place in the app that still names a Material Symbol rather than
   * going through `Icon` (DEX-61): Ionicons has no bold/italic/underline/
   * strikethrough glyph, so there is nothing to convert these four to. This file
   * is `.native.tsx`, so the web half of the fallback is unreachable and only
   * Android draws them. See `docs/design.md`.
   */
  symbol: SymbolViewProps["name"];
  label: string;
  /** Instance method toggled on press. */
  method:
    "toggleBold" | "toggleItalic" | "toggleUnderline" | "toggleStrikethrough";
};

/** Inline-format toggles shown in the accessory bar, left to right. */
const FORMAT_CONTROLS: TFormatControl[] = [
  {
    key: "bold",
    symbol: { ios: "bold", android: "format_bold", web: "format_bold" },
    label: "Bold",
    method: "toggleBold",
  },
  {
    key: "italic",
    symbol: { ios: "italic", android: "format_italic", web: "format_italic" },
    label: "Italic",
    method: "toggleItalic",
  },
  {
    key: "underline",
    symbol: {
      ios: "underline",
      android: "format_underlined",
      web: "format_underlined",
    },
    label: "Underline",
    method: "toggleUnderline",
  },
  {
    key: "strikethrough",
    symbol: {
      ios: "strikethrough",
      android: "format_strikethrough",
      web: "format_strikethrough",
    },
    label: "Strikethrough",
    method: "toggleStrikethrough",
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
  const insets = useSafeAreaInsets();
  const inputRef = useRef<EnrichedMarkdownTextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  const [state, setState] = useState<StyleState | null>(null);

  // Ride the top edge of the keyboard as it animates in/out (UI thread).
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboard.height.value }],
  }));

  // Shrinks the frame, not padding (the library ignores it as a scroll
  // inset) — not automaticallyAdjustKeyboardInsets (DEX-92), which needs a ScrollView.
  const editorInsetStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(
      keyboard.height.value + (focused ? BAR_HEIGHT : 0),
      insets.bottom,
    ),
  }));

  // React fires no blur on unmount, which would otherwise leave the host's
  // swipe gesture disabled on the next day.
  useEffect(() => () => onFocusChange?.(false), [onFocusChange]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.editorFill, editorInsetStyle]}>
        <EnrichedMarkdownTextInput
          ref={inputRef}
          autoFocus={autoFocus}
          cursorColor={theme.colors.primary}
          defaultValue={initialValue}
          multiline
          onBlur={() => {
            setFocused(false);
            // Clear so a later focus doesn't flash the previous caret's
            // highlights before the input emits a fresh state.
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
            styles.editor,
            // Body copy, not a heading: the writing surface takes the same role
            // token as the rest of the app's prose.
            theme.fonts.body,
            { color: theme.colors.text, padding: theme.space.md },
          ])}
          testID={testID}
        />
      </Animated.View>
      {focused && (
        <Animated.View
          style={[
            styles.accessory,
            barStyle,
            {
              backgroundColor: theme.colors.surfaceSunken,
              borderTopColor: theme.colors.border,
              paddingHorizontal: theme.space.md,
            },
          ]}
        >
          <View style={[styles.tools, { gap: theme.space.lg }]}>
            {FORMAT_CONTROLS.map((control) => {
              const active = state?.[control.key].isActive ?? false;
              return (
                <Pressable
                  key={control.key}
                  accessibilityLabel={control.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  hitSlop={theme.space.sm}
                  onPress={() => inputRef.current?.[control.method]()}
                  style={styles.tool}
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
  container: {
    flex: 1,
  },
  // Wraps the input; its animated paddingBottom shrinks the input's frame to the
  // visible viewport (see `editorInsetStyle`) so the built-in caret-scroll works.
  editorFill: {
    flex: 1,
  },
  editor: {
    flex: 1,
  },
  accessory: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    flexDirection: "row",
    height: BAR_HEIGHT,
    justifyContent: "space-between",
    left: 0,
    position: "absolute",
    right: 0,
  },
  tools: {
    alignItems: "center",
    flexDirection: "row",
  },
  tool: {
    alignItems: "center",
    justifyContent: "center",
  },
});
