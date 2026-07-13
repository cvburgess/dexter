import { useEffect, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { TextInput } from "@/components/TextInput";
import { usePreferences } from "@/hooks/usePreferences";
import { SETTINGS_TWO_PANE_MIN_WIDTH } from "@/utils/settingsItems";
import { useTheme, withOpacity } from "@/utils/theme";

export default function NotesScreen() {
  const theme = useTheme();
  const [preferences, { updatePreferences }] = usePreferences();
  const { width } = useWindowDimensions();
  // See account.tsx: the sidebar absorbs the left inset in two-pane mode.
  const twoPane = width >= SETTINGS_TWO_PANE_MIN_WIDTH;

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
        <View
          style={[
            styles.toggle,
            {
              backgroundColor: theme.colors.card,
              borderRadius: theme.borderRadius,
            },
          ]}
        >
          <Text style={[styles.toggleLabel, { color: theme.colors.text }]}>
            Notes
          </Text>
          <Switch
            accessibilityLabel="Notes"
            value={preferences.enableNotes}
            onValueChange={(enableNotes) => updatePreferences({ enableNotes })}
            trackColor={{
              true: theme.colors.primary,
              false: withOpacity(theme.colors.text, 0.2),
            }}
          />
        </View>

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
  toggle: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
});
