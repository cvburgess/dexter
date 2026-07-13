import Ionicons from "@react-native-vector-icons/ionicons";
import { useEffect, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { TextInput } from "@/components/TextInput";
import { usePreferences } from "@/hooks/usePreferences";
import { SETTINGS_TWO_PANE_MIN_WIDTH } from "@/utils/settingsItems";
import { useTheme, withOpacity } from "@/utils/theme";

export default function JournalScreen() {
  const theme = useTheme();
  const [preferences, { updatePreferences }] = usePreferences();
  const { width } = useWindowDimensions();
  // See account.tsx: the sidebar absorbs the left inset in two-pane mode.
  const twoPane = width >= SETTINGS_TWO_PANE_MIN_WIDTH;

  // Edit prompts locally and commit on blur so we don't write a preference on
  // every keystroke. Re-sync from the stored value when it changes elsewhere
  // (add/delete, or another device), but never while a field is focused — that
  // would clobber in-progress typing. A single flag suffices since only one
  // field is focused at a time. Mirrors notes.tsx.
  const [drafts, setDrafts] = useState(preferences.templatePrompts);
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setDrafts(preferences.templatePrompts);
  }, [preferences.templatePrompts]);

  const commitPrompt = (index: number) => {
    focusedRef.current = false;
    const draft = drafts[index] ?? "";
    if (draft !== preferences.templatePrompts[index]) {
      updatePreferences({
        templatePrompts: preferences.templatePrompts.map((prompt, i) =>
          i === index ? draft : prompt,
        ),
      });
    }
  };

  const addPrompt = () => {
    updatePreferences({
      templatePrompts: [...preferences.templatePrompts, ""],
    });
  };

  const deletePrompt = (index: number) => {
    updatePreferences({
      templatePrompts: preferences.templatePrompts.filter(
        (_, i) => i !== index,
      ),
    });
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
            Journal
          </Text>
          <Switch
            accessibilityLabel="Journal"
            value={preferences.enableJournal}
            onValueChange={(enableJournal) =>
              updatePreferences({ enableJournal })
            }
            trackColor={{
              true: theme.colors.primary,
              false: withOpacity(theme.colors.text, 0.2),
            }}
          />
        </View>

        {preferences.enableJournal && (
          <View style={styles.section}>
            <SettingsSectionTitle>Journal prompts</SettingsSectionTitle>
            {drafts.map((prompt, index) => (
              <View key={index} style={styles.promptRow}>
                <TextInput
                  accessibilityLabel={`Journal prompt ${index + 1}`}
                  onBlur={() => commitPrompt(index)}
                  onChangeText={(text) =>
                    setDrafts((current) =>
                      current.map((p, i) => (i === index ? text : p)),
                    )
                  }
                  onFocus={() => (focusedRef.current = true)}
                  placeholder="e.g. What went well today?"
                  style={styles.promptInput}
                  value={prompt}
                />
                <TouchableOpacity
                  accessibilityLabel={`Delete prompt ${index + 1}`}
                  accessibilityRole="button"
                  onPress={() => deletePrompt(index)}
                  style={styles.deleteButton}
                  testID={`delete-prompt-${index}`}
                >
                  <Ionicons
                    color={theme.colors.error}
                    name="trash-outline"
                    size={22}
                  />
                </TouchableOpacity>
              </View>
            ))}
            <Button variant="default" onPress={addPrompt}>
              Add prompt
            </Button>
            <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
              These prompts seed each new day&apos;s Journal. Editing them
              doesn&apos;t change days you&apos;ve already answered.
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
  deleteButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  hint: {
    fontSize: 13,
  },
  promptInput: {
    flex: 1,
  },
  promptRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  section: {
    gap: 10,
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
