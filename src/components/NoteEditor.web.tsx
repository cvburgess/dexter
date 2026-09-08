import { useMemo } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { EnrichedMarkdownText } from "react-native-enriched-markdown";

import { markdownStyle, NOTE_MD4C_FLAGS } from "@/utils/markdownStyle";
import { useTheme } from "@/utils/theme";

import { TNoteEditorProps } from "./NoteEditor.types";

// Read-only on web (upstream #392 has no web input yet). `testID` sits on the
// ScrollView because the web renderer's props are plain HTML attributes.
export function NoteEditor({ initialValue, testID }: TNoteEditorProps) {
  const theme = useTheme();
  const style = useMemo(() => markdownStyle(theme), [theme]);

  return (
    <ScrollView style={styles.container} testID={testID}>
      <EnrichedMarkdownText
        containerStyle={{ padding: theme.space.md }}
        // Toggling a checkbox here would never reach Supabase.
        enableTaskListItemToggle={false}
        markdown={initialValue}
        markdownStyle={style}
        md4cFlags={NOTE_MD4C_FLAGS}
        selectionColor={theme.colors.primary}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
