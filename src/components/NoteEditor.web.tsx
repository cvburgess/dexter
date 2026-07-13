import { ScrollView, StyleSheet, Text } from "react-native";

import { useTheme } from "@/utils/theme";

import { TNoteEditorProps } from "./NoteEditor.types";

/**
 * Web fallback for the note editor. `react-native-enriched-markdown` does not
 * yet support its editable text input on web
 * (software-mansion/react-native-enriched-markdown#392), so web renders the
 * note **read-only** as its raw markdown source; `onChangeMarkdown` is ignored.
 * We deliberately do not import the library's web renderer here — it pulls an
 * optional `katex` peer into the web bundle that isn't installed — so the
 * native module stays strictly native-only. Editing/rich rendering lands here
 * once upstream ships web input support.
 */
export function NoteEditor({ initialValue, testID }: TNoteEditorProps) {
  const theme = useTheme();

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={styles.container}
      testID={testID}
    >
      <Text selectable style={[styles.text, { color: theme.colors.text }]}>
        {initialValue}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
  },
});
