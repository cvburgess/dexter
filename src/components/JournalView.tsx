import { useCallback, useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { TDay, TJournalPrompt } from "@/api/days";
import { useDays } from "@/hooks/useDays";
import { useTheme } from "@/utils/theme";

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
  const theme = useTheme();
  const [day, { isLoading, upsertDayAsync }] = useDays(date);

  if (isLoading) return <LoadingScreen />;

  if (day.prompts.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
          Add journal prompts in Settings → Journal
        </Text>
      </View>
    );
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
  const theme = useTheme();

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
    <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
      {prompts.map(({ prompt, response }, index) => (
        <View key={index} style={styles.row}>
          <Text style={[styles.label, { color: theme.colors.text }]}>
            {prompt}
          </Text>
          <TextInput
            accessibilityLabel={prompt}
            defaultValue={response}
            multiline
            onBlur={() => {
              flush();
              onEditingChange?.(false);
            }}
            onChangeText={(text) => handleChangeResponse(index, text)}
            onFocus={() => onEditingChange?.(true)}
            placeholder="Write your response…"
            style={styles.input}
            testID={`journal-response-${index}`}
            textAlignVertical="top"
          />
        </View>
      ))}
    </ScrollView>
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
  input: {
    minHeight: 80,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  empty: {
    fontSize: 15,
    textAlign: "center",
  },
});
