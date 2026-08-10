import { useNavigation } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { HeaderAddButton } from "@/components/HeaderAddButton";
import { PickerField } from "@/components/PickerField";
import { RowDeleteButton, rowDeleteInset } from "@/components/RowDeleteButton";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { SettingsToggleCard } from "@/components/SettingsToggleCard";
import { TextInput } from "@/components/TextInput";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import {
  NO_SUN_SIGN,
  SUN_SIGN_OPTIONS,
  TSunSignOption,
} from "@/utils/horoscope";
import {
  EDGES_SINGLE_PANE,
  EDGES_TWO_PANE,
} from "@/utils/settingsSafeAreaEdges";
import { useTheme } from "@/utils/theme";

/**
 * Settings for the guided Ritual flow (DEX-34): whether its Horoscope and
 * Journal steps appear at all, which sign the horoscope reads, and the prompts
 * the journal seeds each day from.
 *
 * Each step's sub-settings sit under its own toggle and hide with it — a sun
 * sign feeds nothing but the Horoscope step, so leaving the picker on screen
 * with the step turned off would offer a choice that changes nothing.
 */
export default function RitualScreen() {
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
            padding: theme.space.md,
            paddingBottom: theme.space.md + insets.bottom,
            // The in-group step only: `SettingsSectionTitle` carries the `lg`
            // between sections itself, so it applies wherever it renders (DEX-61).
            gap: theme.space.sm,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <SettingsToggleCard
          label="Horoscope"
          value={preferences.enableHoroscope}
          onValueChange={(enableHoroscope) =>
            updatePreferences({ enableHoroscope })
          }
        />

        {preferences.enableHoroscope && (
          <View style={{ gap: theme.space.sm }}>
            <SettingsSectionTitle subtitle="The Horoscope step reads this sign's prediction for the day.">
              Horoscope
            </SettingsSectionTitle>
            {/* The card is here rather than inside `PickerField` for the reason
                settings/tasks/index.tsx spells out: this is a settings input,
                while the field's other call sites are bare rows stacked into a
                form. Same surface/radius/padding as `SettingsToggleCard`. */}
            <View
              style={{
                backgroundColor: theme.colors.surfaceSunken,
                borderRadius: theme.radii.md,
                padding: theme.space.md,
              }}
            >
              <PickerField<TSunSignOption>
                label="Sun sign"
                options={SUN_SIGN_OPTIONS}
                // An unset sign is `null` in the DB but the Picker needs a value
                // matching one of its items, so it lands on the "Not set"
                // sentinel and is mapped back on the way out.
                selectedValue={preferences.sunSign ?? NO_SUN_SIGN}
                testID="sun-sign-picker"
                onValueChange={(value) =>
                  updatePreferences({
                    sunSign: value === NO_SUN_SIGN ? null : value,
                  })
                }
              />
            </View>
          </View>
        )}

        <SettingsToggleCard
          label="Journal"
          value={preferences.enableJournal}
          onValueChange={(enableJournal) =>
            updatePreferences({ enableJournal })
          }
        />

        {preferences.enableJournal && (
          <View style={{ gap: theme.space.sm }}>
            <SettingsSectionTitle subtitle="These prompts seed each new day's Journal. Editing them doesn't change days you've already answered.">
              Journal prompts
            </SettingsSectionTitle>
            {drafts.length === 0 ? (
              <Text
                style={[
                  theme.fonts.body,
                  { paddingVertical: theme.space.sm },
                  { color: theme.colors.textSecondary },
                ]}
              >
                Tap ＋ to add your first prompt.
              </Text>
            ) : (
              <View style={{ gap: theme.space.sm }}>
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
                      style={{ paddingRight: rowDeleteInset(theme) }}
                      value={prompt}
                    />
                    <RowDeleteButton
                      accessibilityLabel={`Delete prompt ${index + 1}`}
                      onPress={() => deletePrompt(index)}
                      testID={`delete-prompt-${index}`}
                    />
                  </View>
                ))}
              </View>
            )}
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
  // The anchor `RowDeleteButton` parks against; the field fills it.
  promptRow: {
    justifyContent: "center",
    position: "relative",
  },
});
