import Ionicons from "@react-native-vector-icons/ionicons";
import { useNavigation } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { HeaderAddButton } from "@/components/HeaderAddButton";
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

export default function JournalScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [preferences, { updatePreferences }] = usePreferences();
  // See account.tsx: the sidebar absorbs the left inset in two-pane mode.
  const twoPane = useIsLargeDevice();
  const insets = useSafeAreaInsets();

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

  // A "+" in the header adds a prompt (mirrors Habits), but only when the
  // Journal is on. Re-wired on every render so the handler closes over the
  // latest drafts and the `enableJournal` gate stays current.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderAddButton
          accessibilityLabel="Add prompt"
          visible={preferences.enableJournal}
          onPress={addPrompt}
          testID="add-prompt-button"
        />
      ),
    });
  });

  return (
    <SafeAreaView
      edges={twoPane ? EDGES_TWO_PANE : EDGES_SINGLE_PANE}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        // Insets the content by the keyboard's height (iOS) so a focused prompt
        // low on the screen is scrolled clear of it rather than left covered.
        // Android resizes the window instead (Expo's default
        // softwareKeyboardLayoutMode), and web has no overlay keyboard. Matches
        // new-task.tsx and settings/tasks/[id].tsx (DEX-92). This replaced an
        // animated wrapper that padded the scroller's *frame* by the keyboard
        // height: that gave scroll room past the last field but never moved
        // content, so the field stayed under the keyboard. Don't reintroduce it
        // alongside this prop — the two would both subtract the keyboard.
        automaticallyAdjustKeyboardInsets
        // The edges above omit `bottom`, so the content carries the tab bar's
        // inset (DEX-91).
        contentContainerStyle={[
          styles.content,
          {
            padding: theme.spacing,
            paddingBottom: theme.spacing + insets.bottom,
            gap: theme.spacing,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <SettingsToggleCard
          label="Journal"
          value={preferences.enableJournal}
          onValueChange={(enableJournal) =>
            updatePreferences({ enableJournal })
          }
        />

        {preferences.enableJournal && (
          <View style={styles.section}>
            <SettingsSectionTitle>Journal prompts</SettingsSectionTitle>
            {drafts.length === 0 ? (
              <Text
                style={[styles.empty, { color: theme.colors.textSecondary }]}
              >
                Tap ＋ to add your first prompt.
              </Text>
            ) : (
              <View style={{ gap: theme.gap }}>
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
              </View>
            )}
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
  empty: {
    fontSize: 14,
    paddingVertical: 8,
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
});
