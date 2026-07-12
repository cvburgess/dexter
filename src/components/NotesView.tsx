import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useDays } from "@/hooks/useDays";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme, withOpacity } from "@/utils/theme";

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
 * `useDays`, autosaving edits (debounced). When the stored note is blank and a
 * daily-note template is configured, it first offers the user a choice between
 * seeding the template and starting blank (DEX-37). Remount this per-date (via
 * `key`) so the choice resets and the editor re-seeds when the day changes.
 */
export function NotesView({ date }: TNotesViewProps) {
  const theme = useTheme();
  const [day, { isLoading, upsertDay }] = useDays(date);
  const [preferences] = usePreferences();
  const [blankChosen, setBlankChosen] = useState(false);

  // `upsertDay` is stable, but read it through a ref so the debounce/unmount
  // flush never captures a stale closure.
  const upsertRef = useRef(upsertDay);
  useEffect(() => {
    upsertRef.current = upsertDay;
  }, [upsertDay]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string | null>(null);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pendingRef.current !== null) {
      upsertRef.current({ notes: pendingRef.current });
      pendingRef.current = null;
    }
  }, []);

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

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const hasTemplate = preferences.templateNote.trim().length > 0;
  const isBlank = day.notes.length === 0;

  if (isBlank && hasTemplate && !blankChosen) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.prompt, { color: theme.colors.textSecondary }]}>
          Start today&apos;s note
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => upsertDay({ notes: preferences.templateNote })}
          style={[
            styles.button,
            {
              backgroundColor: theme.colors.primary,
              borderRadius: theme.borderRadius,
            },
          ]}
        >
          <Text
            style={[styles.buttonText, { color: theme.colors.primaryContent }]}
          >
            Use daily note template
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => setBlankChosen(true)}
          style={[
            styles.button,
            styles.buttonSecondary,
            {
              borderColor: withOpacity(theme.colors.text, 0.2),
              borderRadius: theme.borderRadius,
            },
          ]}
        >
          <Text style={[styles.buttonText, { color: theme.colors.text }]}>
            Blank note
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <NoteEditor
      initialValue={day.notes}
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
    alignItems: "center",
    minWidth: 220,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonSecondary: {
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
