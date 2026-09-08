import { useEffect, useMemo } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { EnrichedMarkdownTextInput } from "react-native-enriched-markdown";

import { markdownInputStyle } from "@/utils/markdownStyle";
import { useTheme } from "@/utils/theme";

import { TNoteEditorProps } from "./NoteEditor.types";

// Uncontrolled (defaultValue + onChangeMarkdown) so React never fights the
// caret; formatting is the input's own selection menu, not a toolbar.

// The input routes tap-outside and swipe-down dismissal through whatever
// ScrollView encloses it, so this wrapper is what closes the keyboard.

export function NoteEditor({
  initialValue,
  onChangeMarkdown,
  placeholder,
  autoFocus,
  onFocusChange,
  testID,
}: TNoteEditorProps) {
  const theme = useTheme();
  const inputStyle = useMemo(() => markdownInputStyle(theme), [theme]);

  // React fires no blur on unmount, which would otherwise leave the host's
  // swipe gesture disabled on the next day.
  useEffect(() => () => onFocusChange?.(false), [onFocusChange]);

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={styles.fill}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      style={styles.fill}
    >
      <EnrichedMarkdownTextInput
        autoFocus={autoFocus}
        cursorColor={theme.colors.primary}
        defaultValue={initialValue}
        markdownStyle={inputStyle}
        multiline
        onBlur={() => onFocusChange?.(false)}
        onChangeMarkdown={onChangeMarkdown}
        onFocus={() => onFocusChange?.(true)}
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
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
