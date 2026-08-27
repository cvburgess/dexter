import { ScrollView, StyleSheet, Text } from "react-native";

import { useTheme } from "@/utils/theme";

import { TNoteEditorProps } from "./NoteEditor.types";

// Web fallback: renders read-only raw markdown (upstream #392 has no web
// input yet); the library's web renderer is unimported since it pulls an
// uninstalled katex peer into the bundle.
export function NoteEditor({ initialValue, testID }: TNoteEditorProps) {
  const theme = useTheme();

  return (
    <ScrollView
      contentContainerStyle={{ padding: theme.space.md }}
      style={styles.container}
      testID={testID}
    >
      <Text
        selectable
        style={[theme.fonts.body, styles.text, { color: theme.colors.text }]}
      >
        {initialValue}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  text: {
    lineHeight: 24,
  },
});
