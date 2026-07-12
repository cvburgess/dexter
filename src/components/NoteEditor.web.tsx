import { EnrichedMarkdownText } from "react-native-enriched-markdown";
import { ScrollView, StyleSheet } from "react-native";

import { TNoteEditorProps } from "./NoteEditor.types";

/**
 * Web fallback for the note editor. `react-native-enriched-markdown` does not
 * yet support its editable text input on web
 * (software-mansion/react-native-enriched-markdown#392), so web renders the
 * note **read-only** via `EnrichedMarkdownText`; `onChangeMarkdown` is ignored.
 * Editing lands here once upstream ships web input support.
 */
export function NoteEditor({ initialValue, testID }: TNoteEditorProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={styles.container}
      testID={testID}
    >
      <EnrichedMarkdownText markdown={initialValue} selectable />
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
});
