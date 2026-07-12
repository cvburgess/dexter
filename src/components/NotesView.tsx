import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useDays } from "@/hooks/useDays";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/utils/theme";

import { Button } from "./Button";
import { LoadingScreen } from "./LoadingScreen";
import { NoteEditor } from "./NoteEditor";

type TNotesViewProps = {
  /** ISO date (YYYY-MM-DD) of the day whose note is shown. */
  date: string;
};

// Autosave cadence: long enough to coalesce a burst of keystrokes into one
// write, short enough that a note is safe within a second of pausing.
const SAVE_DEBOUNCE_MS = 800;

/**
 * The Notes surface for a single day. Reads/writes the day's markdown note via
 * `useDays`, autosaving edits (debounced). When the day has no note row yet and
 * a daily-note template is configured, it first offers the user a choice
 * between seeding the template and starting blank; both choices write a row, so
 * the choice persists across remounts/tab switches instead of re-prompting
 * (DEX-37). Remount this per-date (via `key`) so the editor re-seeds when the
 * day changes.
 */
export function NotesView({ date }: TNotesViewProps) {
  const theme = useTheme();
  const [day, { isLoading, exists, upsertDay }] = useDays(date);
  const [preferences] = usePreferences();

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string | null>(null);

  // React Query's `mutate` is referentially stable, so closing over `upsertDay`
  // keeps `flush` stable and the unmount effect below fires cleanup only on
  // unmount.
  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pendingRef.current !== null) {
      upsertDay({ notes: pendingRef.current });
      pendingRef.current = null;
    }
  }, [upsertDay]);

  const handleChangeMarkdown = useCallback(
    (markdown: string) => {
      pendingRef.current = markdown;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  // Persist any pending edit when the view unmounts (date change / tab switch).
  useEffect(() => flush, [flush]);

  if (isLoading) return <LoadingScreen />;

  const hasTemplate = preferences.templateNote.trim().length > 0;

  // Only prompt before the day has a note row: once either choice writes a row,
  // `exists` stays true across remounts, so the chooser never resurfaces (and
  // clearing an existing note to empty keeps the editor, not the chooser).
  if (!exists && hasTemplate) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.prompt, { color: theme.colors.textSecondary }]}>
          Start this day&apos;s note
        </Text>
        <Button
          variant="primary"
          style={styles.button}
          onPress={() => upsertDay({ notes: preferences.templateNote })}
        >
          Use daily note template
        </Button>
        <Button
          variant="default"
          style={styles.button}
          onPress={() => upsertDay({ notes: "" })}
        >
          Blank note
        </Button>
      </View>
    );
  }

  return (
    <NoteEditor
      initialValue={day.notes ?? ""}
      onChangeMarkdown={handleChangeMarkdown}
      placeholder="Write today's note…"
      testID="note-editor"
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24,
  },
  prompt: {
    fontSize: 15,
    marginBottom: 4,
  },
  button: {
    minWidth: 240,
  },
});
