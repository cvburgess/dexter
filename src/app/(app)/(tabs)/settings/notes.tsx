import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { SettingsToggleCard } from "@/components/SettingsToggleCard";
import { TextInput } from "@/components/TextInput";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import {
  EDGES_SINGLE_PANE,
  EDGES_TWO_PANE,
} from "@/utils/settingsSafeAreaEdges";
import { useTheme } from "@/utils/theme";

export default function NotesScreen() {
  const theme = useTheme();
  const [preferences, { updatePreferences }] = usePreferences();
  // See account.tsx: the sidebar absorbs the left inset in two-pane mode.
  const twoPane = useIsLargeDevice();
  const insets = useSafeAreaInsets();

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
      edges={twoPane ? EDGES_TWO_PANE : EDGES_SINGLE_PANE}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        // The edges above omit `bottom` so content scrolls under the
        // translucent tab bar; adding the inset to the content's own bottom
        // padding is what lets the last row clear it (DEX-91).
        contentContainerStyle={[
          styles.content,
          {
            padding: theme.space.md,
            paddingBottom: theme.space.md + insets.bottom,
            // The in-group step only: `SettingsSectionTitle` carries the `lg`
            // between sections itself, so it applies wherever it renders (DEX-61).
            gap: theme.space.sm,
          },
        ]}
      >
        <SettingsToggleCard
          label="Notes"
          value={preferences.enableNotes}
          onValueChange={(enableNotes) => updatePreferences({ enableNotes })}
        />

        {preferences.enableNotes && (
          <View style={{ gap: theme.space.sm }}>
            <SettingsSectionTitle subtitle="When set, opening a blank daily note offers to start from this template.">
              Daily note template
            </SettingsSectionTitle>
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
  template: {
    minHeight: 160,
  },
});
