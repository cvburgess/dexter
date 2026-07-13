import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TDay, TJournalPrompt } from "@/api/days";
import { useDays } from "@/hooks/useDays";
import { useTheme } from "@/utils/theme";

import { EmptyScreen } from "./EmptyScreen";
import { LoadingScreen } from "./LoadingScreen";
import { TextInput } from "./TextInput";

type TJournalViewProps = {
  /** ISO date (YYYY-MM-DD) of the day whose journal is shown. */
  date: string;
  /** Fired as a response field gains/loses focus, so the host can disable
   * day-swipe while editing. */
  onEditingChange?: (editing: boolean) => void;
};

// Autosave cadence: long enough to coalesce a burst of keystrokes into one
// write, short enough that a response is safe within a second of pausing.
// Matches NotesView.
const SAVE_DEBOUNCE_MS = 800;

// Approximate line height for the response field's 16px font, used to size a
// field from its line count. Fields grow from here as the user types (see
// JournalResponseField), so a short answer doesn't render as a tall empty box
// that's more likely to sit under the keyboard.
const RESPONSE_LINE_HEIGHT = 20;

// Height for `lines` lines of response text, including the shared TextInput's
// own vertical padding. Deliberately synchronous (no native measurement
// callback like `onContentSizeChange`): `today/index.tsx` already documents
// this app hitting stale/corrupted async-sizing native views during rapid
// day-paging remounts (the @expo/ui menu-host issue TaskCard pins heights to
// avoid) — a text-derived estimate can't go stale the same way.
const responseHeight = (lines: number, spacing: number) =>
  Math.max(1, lines) * RESPONSE_LINE_HEIGHT + spacing * 2;

/**
 * The Journal surface for a single day. Reads/writes the day's reflection
 * prompts via `useDays`, autosaving edits (debounced). Responses are plain text
 * (unlike Notes' markdown editor), so this renders identically on web and
 * native. Prompts auto-seed from `preferences.templatePrompts` (via
 * `useDays.defaultDay`), so there is no template chooser — nothing persists
 * until the user answers. Remounted per date by `SwipeableDay` (keyed on the
 * day), which re-seeds the uncontrolled inputs when the day changes.
 */
export function JournalView({ date, onEditingChange }: TJournalViewProps) {
  const [day, { isLoading, upsertDayAsync }] = useDays(date);

  if (isLoading) return <LoadingScreen />;

  if (day.prompts.length === 0) {
    return <EmptyScreen message="Add journal prompts in Settings → Journal" />;
  }

  // Mount the editor only once the day has loaded so its refs/inputs seed from
  // the real prompts rather than the loading-time default (empty responses).
  // Key it on the prompt labels so a template change (add/edit/delete a prompt
  // in Settings) re-seeds a still-mounted editor — the Today screen stays
  // mounted across tab switches, so without this the frozen refs would diverge
  // from the rendered inputs and a save would drop the new/renamed prompt.
  // Response-only edits keep the labels, so autosaves don't remount.
  return (
    <JournalEditor
      key={JSON.stringify(day.prompts.map((p) => p.prompt))}
      prompts={day.prompts}
      upsertDayAsync={upsertDayAsync}
      onEditingChange={onEditingChange}
    />
  );
}

type TJournalEditorProps = {
  prompts: TJournalPrompt[];
  upsertDayAsync: (diff: { prompts: TJournalPrompt[] }) => Promise<TDay>;
  onEditingChange?: (editing: boolean) => void;
};

function JournalEditor({
  prompts,
  upsertDayAsync,
  onEditingChange,
}: TJournalEditorProps) {
  const keyboard = useAnimatedKeyboard();
  const insets = useSafeAreaInsets();

  // Shrink the scroll area's own frame to the visible viewport as the keyboard
  // rises, so there's always scroll room past the last field instead of it
  // running under the keyboard with nowhere to scroll to. The host's
  // SafeAreaView excludes "bottom" (the tab bar owns that inset), so fall back
  // to the safe-area inset when the keyboard is closed.
  const keyboardInsetStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(keyboard.height.value, insets.bottom),
  }));

  // Track the latest per-index text so a save can rebuild the whole array,
  // seeded from the loaded responses. Seeded once at mount; the editor is
  // remounted (re-seeding) whenever the prompt labels change, so the label set
  // stays invariant for this mount's lifetime.
  const responsesRef = useRef(prompts.map((p) => p.response));

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<TJournalPrompt[] | null>(null);
  const savingRef = useRef(false);

  // Drain pending edits one save at a time, always sending the latest prompts.
  // Serializing (never two saves in flight) keeps overlapping debounced/retrying
  // saves from writing older responses over newer ones — both the server and the
  // React Query cache stay last-edit-wins. Mirrors NotesView. React Query's
  // mutate is referentially stable, so closing over `upsertDayAsync` is stable.
  const drainSaves = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      while (pendingRef.current !== null) {
        const pending = pendingRef.current;
        pendingRef.current = null;
        try {
          await upsertDayAsync({ prompts: pending });
        } catch {
          // Retries (in useDays) are exhausted. Requeue unless newer text
          // already arrived, then stop so we don't hot-loop a persistent
          // failure — the next edit/unmount flush retries.
          if (pendingRef.current === null) pendingRef.current = pending;
          break;
        }
      }
    } finally {
      savingRef.current = false;
    }
  }, [upsertDayAsync]);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    void drainSaves();
  }, [drainSaves]);

  const handleChangeResponse = useCallback(
    (index: number, text: string) => {
      responsesRef.current[index] = text;
      // Rebuild the full array on every edit: `upsertDay({ prompts })` replaces
      // the whole column, so a partial array would drop the other responses.
      // Labels are invariant for this mount (the editor is keyed on them), so
      // reading them off the prop is safe. (`notes` is preserved by the partial
      // upsert.)
      pendingRef.current = prompts.map((prompt, i) => ({
        prompt: prompt.prompt,
        response: responsesRef.current[i],
      }));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [flush, prompts],
  );

  // Persist any pending edit when the view unmounts (date change / tab switch).
  useEffect(() => flush, [flush]);

  // Reset the host's editing flag on unmount so a date change while a field is
  // focused (which unmounts the input without a reliable `onBlur`) can't leave
  // day-swipe suspended on the next day. Mirrors NoteEditor's unmount reset.
  useEffect(() => () => onEditingChange?.(false), [onEditingChange]);

  return (
    <Animated.View style={[styles.scroll, keyboardInsetStyle]}>
      <ScrollView
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      >
        {prompts.map(({ prompt, response }, index) => (
          <JournalResponseField
            key={index}
            prompt={prompt}
            response={response}
            onBlur={() => {
              flush();
              onEditingChange?.(false);
            }}
            onChangeText={(text) => handleChangeResponse(index, text)}
            onFocus={() => onEditingChange?.(true)}
            testID={`journal-response-${index}`}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

type TJournalResponseFieldProps = {
  prompt: string;
  response: string;
  onBlur: () => void;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  testID: string;
};

// A single prompt + response row. Starts at one line and grows with the
// content instead of rendering a tall empty box up front — a short answer is
// much less likely to end up sitting under the keyboard. Height is derived
// from the text's own line count (see `responseHeight`), not a native
// measurement callback, so a remount always starts from a correct, freshly
// computed size — it can't inherit a stale size left over by the previous day.
function JournalResponseField({
  prompt,
  response,
  onBlur,
  onChangeText,
  onFocus,
  testID,
}: TJournalResponseFieldProps) {
  const theme = useTheme();
  const [height, setHeight] = useState(() =>
    responseHeight(response.split("\n").length, theme.spacing),
  );

  const handleChangeText = (text: string) => {
    setHeight(responseHeight(text.split("\n").length, theme.spacing));
    onChangeText(text);
  };

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{prompt}</Text>
      <TextInput
        accessibilityLabel={prompt}
        defaultValue={response}
        multiline
        onBlur={onBlur}
        onChangeText={handleChangeText}
        onFocus={onFocus}
        placeholder="Write your response…"
        style={{ height }}
        testID={testID}
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  list: {
    gap: 20,
    padding: 16,
  },
  row: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
});
