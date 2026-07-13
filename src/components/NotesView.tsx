import { useCallback, useEffect, useRef, useState } from "react";
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
  /** Fired as the editor gains/loses focus, so the host can disable day-swipe
   * while editing. */
  onEditingChange?: (editing: boolean) => void;
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
export function NotesView({ date, onEditingChange }: TNotesViewProps) {
  const theme = useTheme();
  const [day, { isLoading, exists, upsertDay, upsertDayAsync }] = useDays(date);
  const [preferences] = usePreferences();
  // Latches once the user commits to the editor (picks a choice or types).
  // `exists` persists the choice across remounts, but rolls back to false if a
  // save fails; this local latch keeps the editor mounted through a transient
  // failure so in-progress text isn't discarded back to the chooser.
  const [committed, setCommitted] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string | null>(null);
  const savingRef = useRef(false);

  // Drain pending edits one save at a time, always sending the latest text.
  // Serializing (never two saves in flight) keeps overlapping debounced/retrying
  // saves from writing an older note over a newer one — both the server and the
  // React Query cache stay last-edit-wins. React Query's mutate is referentially
  // stable, so closing over `upsertDayAsync` keeps this stable.
  const drainSaves = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      while (pendingRef.current !== null) {
        const pending = pendingRef.current;
        pendingRef.current = null;
        try {
          await upsertDayAsync({ notes: pending });
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

  const handleChangeMarkdown = useCallback(
    (markdown: string) => {
      setCommitted(true);
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

  // Prompt only before the user has engaged this day's note: `exists` covers a
  // persisted row (survives remounts), `committed` covers the current session
  // (survives a failed save that rolled `exists` back).
  if (!exists && !committed && hasTemplate) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.prompt, { color: theme.colors.textSecondary }]}>
          Start this day&apos;s note
        </Text>
        <Button
          variant="primary"
          style={styles.button}
          onPress={() => {
            setCommitted(true);
            upsertDay({ notes: preferences.templateNote });
          }}
        >
          Use daily note template
        </Button>
        <Button
          variant="default"
          style={styles.button}
          onPress={() => {
            setCommitted(true);
            upsertDay({ notes: "" });
          }}
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
      onFocusChange={onEditingChange}
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
