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
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from "react-native-reanimated";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { HeaderAddButton } from "@/components/HeaderAddButton";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { SettingsToggleCard } from "@/components/SettingsToggleCard";
import { TextInput } from "@/components/TextInput";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
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
  const twoPane = useIsMultiPane();
  const keyboard = useAnimatedKeyboard();
  const insets = useSafeAreaInsets();

  // Shrink the scroll area as the keyboard rises so there's always scroll room
  // past the last field instead of it running under the keyboard with nowhere
  // to scroll to. Deliberately the keyboard height alone, with no safe-area
  // term: this pads the scroller's *frame*, so folding the tab bar's inset in
  // here would end the viewport above the bar and cut content off at it. The
  // bar's inset goes on the scroll content below instead, which lets rows pass
  // under the bar and still scroll clear of it (DEX-91).
  const keyboardInsetStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboard.height.value,
  }));

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
      <Animated.View style={[styles.container, keyboardInsetStyle]}>
        <ScrollView
          // Carries the tab bar's inset (see keyboardInsetStyle above). While
          // the keyboard is up it's slack the wrapper's padding has already
          // pushed out of view, which costs nothing.
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
              <Text
                style={[styles.hint, { color: theme.colors.textSecondary }]}
              >
                These prompts seed each new day&apos;s Journal. Editing them
                doesn&apos;t change days you&apos;ve already answered.
              </Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>
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
