import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { SettingsToggleCard } from "@/components/SettingsToggleCard";
import { TextInput } from "@/components/TextInput";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/utils/theme";

export default function NotesScreen() {
  const theme = useTheme();
  const [preferences, { updatePreferences }] = usePreferences();
  // See account.tsx: the sidebar absorbs the left inset in two-pane mode.
  const twoPane = useIsMultiPane();

  // Edit the template locally and commit on blur so we don't write a
  // preference on every keystroke. Re-sync from the stored value when it
  // changes elsewhere, but never while the field is focused (would clobber
  // in-progress typing).
  const [draft, setDraft] = useState(preferences.templateNote);
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setDraft(preferences.templateNote);
  }, [preferences.templateNote]);

  const commitTemplate = () => {
    focusedRef.current = false;
    if (draft !== preferences.templateNote) {
      updatePreferences({ templateNote: draft });
    }
  };

  return (
    <SafeAreaView
      edges={twoPane ? ["bottom", "right"] : ["bottom", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { padding: theme.spacing, gap: theme.spacing },
        ]}
      >
        <SettingsToggleCard
          label="Notes"
          value={preferences.enableNotes}
          onValueChange={(enableNotes) => updatePreferences({ enableNotes })}
        />

        {preferences.enableNotes && (
          <View style={styles.section}>
            <SettingsSectionTitle>Daily note template</SettingsSectionTitle>
            <TextInput
              accessibilityLabel="Daily note template"
              multiline
              onBlur={commitTemplate}
              onChangeText={setDraft}
              onFocus={() => (focusedRef.current = true)}
              placeholder="Offered when you open a blank daily note"
              style={styles.template}
              textAlignVertical="top"
              value={draft}
            />
            <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
              When set, opening a blank daily note offers to start from this
              template.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  hint: {
    fontSize: 13,
  },
  section: {
    gap: 10,
  },
  template: {
    minHeight: 160,
  },
});
