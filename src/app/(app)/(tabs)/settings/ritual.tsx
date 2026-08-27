import { useNavigation } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { HeaderAddButton } from "@/components/HeaderAddButton";
import { JournalPeriodMenu } from "@/components/JournalPeriodMenu";
import { PickerField } from "@/components/PickerField";
import { RowDeleteButton, rowDeleteInset } from "@/components/RowDeleteButton";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { SettingsToggleCard } from "@/components/SettingsToggleCard";
import { TextInput } from "@/components/TextInput";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import {
  BREATH_COUNT_OPTIONS,
  BREATHING_TECHNIQUE_SETTING_OPTIONS,
  resolveBreathCount,
  resolveBreathingTechniqueSetting,
  type TBreathingTechniqueSetting,
} from "@/utils/breathing";
import {
  NO_SUN_SIGN,
  SUN_SIGN_OPTIONS,
  TSunSignOption,
} from "@/utils/horoscope";
import {
  newTemplatePrompt,
  type TTemplatePrompt,
} from "@/utils/journalPrompts";
import type { TRitualMode } from "@/utils/ritualSteps";
import {
  EDGES_SINGLE_PANE,
  EDGES_TWO_PANE,
} from "@/utils/settingsSafeAreaEdges";
import { useTheme } from "@/utils/theme";

// Ritual flow settings (DEX-34). Each step's sub-settings hide behind its own
// toggle; Breathe has none because the step is unconditional (DEX-164).
export default function RitualScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [preferences, { updatePreferences }] = usePreferences();

  // See account.tsx: the sidebar absorbs the left inset in two-pane mode.
  const twoPane = useIsLargeDevice();
  const insets = useSafeAreaInsets();

  // Edit locally, commit on blur; re-sync from stored value on change
  // elsewhere unless a field is focused, which would clobber typing.
  const [drafts, setDrafts] = useState(preferences.templatePrompts);
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setDrafts(preferences.templatePrompts);
  }, [preferences.templatePrompts]);

  // `drafts` is authoritative, never the preference — it lags a
  // just-committed blur, so deriving from it would clobber the pending edit.
  const commitPrompt = () => {
    focusedRef.current = false;
    const stored = preferences.templatePrompts;
    const changed =
      drafts.length !== stored.length ||
      drafts.some(
        (draft, i) =>
          draft.prompt !== stored[i].prompt ||
          draft.period !== stored[i].period,
      );
    if (changed) updatePreferences({ templatePrompts: drafts });
  };

  // Write drafts straight through (mirrored to the store) so the list
  // re-renders immediately and the next edit builds on the current array.
  const writePrompts = (next: TTemplatePrompt[]) => {
    setDrafts(next);
    updatePreferences({ templatePrompts: next });
  };

  const addPrompt = () => writePrompts([...drafts, newTemplatePrompt()]);

  const deletePrompt = (index: number) =>
    writePrompts(drafts.filter((_, i) => i !== index));

  const setPromptPeriod = (index: number, period: TRitualMode) =>
    writePrompts(
      drafts.map((entry, i) => (i === index ? { ...entry, period } : entry)),
    );

  // Re-wired every render so the handler closes over the latest drafts and
  // the enableJournal gate stays current.
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
        // Scrolls a focused prompt clear of the keyboard on iOS (DEX-92); don't
        // pair with a frame-padding wrapper, which never moves content.
        automaticallyAdjustKeyboardInsets
        // Edges above omit `bottom`, so content carries the tab bar's inset
        // (DEX-91).
        contentContainerStyle={[
          styles.content,
          {
            padding: theme.space.md,
            paddingBottom: theme.space.md + insets.bottom,
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
            {/* Card lives here, not in PickerField: this is a settings input
                while the field's other call sites are bare form rows. */}
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
                // Null in the DB lands on the "Not set" sentinel and is
                // mapped back on the way out.
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
            <SettingsSectionTitle subtitle="Each prompt is asked by one ritual — tap the sun or moon to move it. These seed each new day's Journal; editing them doesn't change days you've already answered.">
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
                {drafts.map(({ id, prompt, period }, index) => (
                  // Keyed by id: an index key would hand a deleted row's input
                  // state to its neighbour once indices shift.
                  <View
                    key={id}
                    style={[styles.promptRow, { gap: theme.space.sm }]}
                  >
                    <JournalPeriodMenu
                      period={period}
                      promptNumber={index + 1}
                      onChange={(next) => setPromptPeriod(index, next)}
                    />
                    {/* Anchor wraps the input alone, or the delete button
                        would cover the menu tile. */}
                    <View style={styles.promptField}>
                      <TextInput
                        accessibilityLabel={`Journal prompt ${index + 1}`}
                        onBlur={commitPrompt}
                        onChangeText={(text) =>
                          setDrafts((current) =>
                            current.map((entry, i) =>
                              i === index ? { ...entry, prompt: text } : entry,
                            ),
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
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* No toggle: Breathe is unconditional. Values below are only what
            the step opens with — its own controls write nothing back. */}
        <View style={{ gap: theme.space.sm }}>
          <SettingsSectionTitle subtitle="The Breathe step opens the evening ritual. Shuffle runs a different technique each day.">
            Breathe
          </SettingsSectionTitle>
          <View
            style={{
              backgroundColor: theme.colors.surfaceSunken,
              borderRadius: theme.radii.md,
              gap: theme.space.sm,
              padding: theme.space.md,
            }}
          >
            <PickerField<TBreathingTechniqueSetting>
              label="Technique"
              options={BREATHING_TECHNIQUE_SETTING_OPTIONS}
              // No CHECK on the column, so narrow on the way in or a value a
              // later build stored leaves the picker showing nothing selected.
              selectedValue={resolveBreathingTechniqueSetting(
                preferences.breathingTechnique,
              )}
              testID="breathing-technique-picker"
              onValueChange={(breathingTechnique) =>
                updatePreferences({ breathingTechnique })
              }
            />
            <PickerField
              label="Breaths"
              options={BREATH_COUNT_OPTIONS}
              // Clamped rather than defaulted — a stored 12 lands on 10, so
              // the menu always has a selection.
              selectedValue={String(
                resolveBreathCount(preferences.breathCount),
              )}
              testID="breath-count-picker"
              onValueChange={(value) =>
                updatePreferences({ breathCount: Number(value) })
              }
            />
          </View>
        </View>
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
  promptField: {
    flex: 1,
    justifyContent: "center",
    position: "relative",
  },
  promptRow: {
    alignItems: "center",
    flexDirection: "row",
  },
});
