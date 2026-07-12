import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from "react-native-reanimated";
import {
  EnrichedMarkdownTextInput,
  type EnrichedMarkdownTextInputInstance,
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
 * A "Done" accessory bar rides the top edge of the keyboard while editing. The
 * native input isn't RN's `TextInput`, so it can't drive an `InputAccessoryView`
 * (no `inputAccessoryViewID` support) and `Keyboard.dismiss()` (which only blurs
 * RN `TextInput`s) is a no-op on it — dismissal must go through the component's
 * own `blur()` ref method. We position a lightweight bar ourselves via
 * reanimated's `useAnimatedKeyboard`. The editor is multiline, so the keyboard's
 * built-in "Done" return key isn't available (Return inserts a newline); an
 * accessory bar is the standard iOS pattern for multiline text. Without it there
 * is no way to dismiss the keyboard, which otherwise covers the bottom tabs.
 */
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
    alignItems: "flex-end",
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    height: 44,
    justifyContent: "center",
    left: 0,
    paddingHorizontal: 16,
    position: "absolute",
    right: 0,
  },
  doneLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
});
