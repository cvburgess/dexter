import { EnrichedMarkdownTextInput } from "react-native-enriched-markdown";
import { StyleSheet } from "react-native";

import { useTheme } from "@/utils/theme";

import { TNoteEditorProps } from "./NoteEditor.types";

/**
 * Native markdown editor backed by `react-native-enriched-markdown`'s
 * `EnrichedMarkdownTextInput` (a Fabric/New-Architecture native view). The
 * editor is uncontrolled — seeded once via `defaultValue` and reporting edits
 * through `onChangeMarkdown` — so we never feed React state back per keystroke
 * (which would fight the caret). Re-seeding on a date change is handled by the
 * consumer remounting this component with a new `key`.
 */
export function NoteEditor({
  initialValue,
  onChangeMarkdown,
  placeholder,
  autoFocus,
  testID,
}: TNoteEditorProps) {
  const theme = useTheme();

  return (
    <EnrichedMarkdownTextInput
      autoFocus={autoFocus}
      cursorColor={theme.colors.primary}
      defaultValue={initialValue}
      multiline
      onChangeMarkdown={onChangeMarkdown}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textSecondary}
      selectionColor={theme.colors.primary}
      style={StyleSheet.flatten([styles.editor, { color: theme.colors.text }])}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  editor: {
    flex: 1,
    fontSize: 16,
    padding: 16,
  },
});
