import Ionicons from "@react-native-vector-icons/ionicons";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
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

  // `drafts` is the authoritative current array: every structural write derives
  // from it, never from `preferences.templatePrompts`. Because `updatePreferences`
  // is optimistic (its cache write is deferred behind `cancelQueries`), the
  // preference lags a just-committed blur — deriving an add/delete from it would
  // compute on the stale array and clobber the pending edit (last-write-wins).
  const commitPrompt = () => {
    focusedRef.current = false;
    const changed =
      drafts.length !== preferences.templatePrompts.length ||
      drafts.some((draft, i) => draft !== preferences.templatePrompts[i]);
    if (changed) updatePreferences({ templatePrompts: drafts });
  };

  // Structural edits write the local drafts straight through (and mirror them to
  // the store) so the list re-renders immediately and the next edit builds on
  // the current array, not the optimistically-lagging preference.
  const writePrompts = (next: string[]) => {
    setDrafts(next);
    updatePreferences({ templatePrompts: next });
  };

  const addPrompt = () => writePrompts([...drafts, ""]);

  const deletePrompt = (index: number) =>
    writePrompts(drafts.filter((_, i) => i !== index));

  return (
    <SafeAreaView
      edges={twoPane ? ["bottom", "right"] : ["bottom", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { padding: theme.spacing, gap: theme.spacing },
          ]}
          keyboardShouldPersistTaps="handled"
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
                    onBlur={commitPrompt}
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
              <Text
                style={[styles.hint, { color: theme.colors.textSecondary }]}
              >
                These prompts seed each new day&apos;s Journal. Editing them
                doesn&apos;t change days you&apos;ve already answered.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
