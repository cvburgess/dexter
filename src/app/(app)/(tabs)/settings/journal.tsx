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
import Animated, {
  KeyboardState,
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useAnimatedStyle,
} from "react-native-reanimated";
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
  const keyboard = useAnimatedKeyboard();
  const scrollRef = useRef<ScrollView>(null);
  // Each prompt row's y-offset within the scroll content, recorded via
  // onLayout, so a focus can scroll straight to it.
  const rowOffsetsRef = useRef<number[]>([]);
  const focusedIndexRef = useRef<number | null>(null);

  // Shrink the scroll area as the keyboard rises so a focused prompt field
  // isn't hidden underneath it. No safe-area fallback needed here (unlike
  // JournalView) — the SafeAreaView below already reserves the resting bottom
  // inset; adding it again here would double that padding when the keyboard
  // is closed.
  const keyboardInsetStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboard.height.value,
  }));

  // Shrinking the viewport only makes room — it doesn't reposition the
  // scroll. With several independent `TextInput`s, RN's built-in
  // scroll-focused-input-into-view is unreliable, so drive it explicitly:
  // scroll the focused row near the top of the now-shrunk visible area.
  const scrollToRow = (index: number) => {
    const y = rowOffsetsRef.current[index];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
    }
  };

  const handleFocus = (index: number) => {
    focusedIndexRef.current = index;
    // Covers switching between fields while the keyboard is already open: its
    // height isn't changing, so a short wait for this frame to settle is
    // enough. A first focus that opens the keyboard from closed is handled
    // by the reaction below instead (see it for why a fixed delay alone
    // isn't reliable there).
    setTimeout(() => scrollToRow(index), 50);
  };

  // The OS keyboard-rise animation (closed → open) runs ~250-300ms — well
  // past `handleFocus`'s fixed 50ms delay — so that delay alone scrolls using
  // a viewport that's still mid-shrink on a field's first focus, and the
  // field ends up covered anyway. Wait for reanimated to report the keyboard
  // has actually finished opening, then scroll to whichever row is focused.
  useAnimatedReaction(
    () => keyboard.state.value,
    (state, previousState) => {
      if (
        state === KeyboardState.OPEN &&
        previousState !== KeyboardState.OPEN &&
        focusedIndexRef.current !== null
      ) {
        runOnJS(scrollToRow)(focusedIndexRef.current);
      }
    },
  );

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
      <Animated.View style={[styles.container, keyboardInsetStyle]}>
        <ScrollView
          ref={scrollRef}
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
                <View
                  key={index}
                  style={styles.promptRow}
                  onLayout={(e) => {
                    rowOffsetsRef.current[index] = e.nativeEvent.layout.y;
                  }}
                >
                  <TextInput
                    accessibilityLabel={`Journal prompt ${index + 1}`}
                    onBlur={() => {
                      if (focusedIndexRef.current === index) {
                        focusedIndexRef.current = null;
                      }
                      commitPrompt();
                    }}
                    onChangeText={(text) =>
                      setDrafts((current) =>
                        current.map((p, i) => (i === index ? text : p)),
                      )
                    }
                    onFocus={() => {
                      focusedRef.current = true;
                      handleFocus(index);
                    }}
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
