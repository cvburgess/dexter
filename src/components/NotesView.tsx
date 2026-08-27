import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ETaskPriority } from "@/api/tasks";
import { useNotes } from "@/hooks/useNotes";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/utils/theme";

import { Button } from "./Button";
import { EmptyScreen } from "./EmptyScreen";
import { LoadingScreen } from "./LoadingScreen";
import { NoteEditor } from "./NoteEditor";

type TNotesViewProps = {
  /** ISO date (YYYY-MM-DD) of the day whose note is shown. */
  date: string;
  /** Fired as the editor gains/loses focus, so the host can disable day-swipe
   * while editing. */
  onEditingChange?: (editing: boolean) => void;
  /** Floating card (own border/fill/gap) or flush transparent fill. Appearance
   * only — the side gutter is the caller's either way. */
  card?: boolean;
};

// Autosave cadence: long enough to coalesce a burst of keystrokes into one
// write, short enough that a note is safe within a second of pausing.
const SAVE_DEBOUNCE_MS = 800;

// Bottom overhang for the "trails off" look — a negative margin plus a
// matching padding that keeps editor content on-screen.
const CARD_TRAIL_OFF = 24;

// Autosaving markdown note surface for a day. With no note row and a
// template configured, offers template-vs-blank; both write a row (DEX-37).
export function NotesView({
  date,
  onEditingChange,
  card = true,
}: TNotesViewProps) {
  const theme = useTheme();
  const [note, { isLoading, exists, upsertNote, upsertNoteAsync }] =
    useNotes(date);
  const [preferences] = usePreferences();
  // Keeps the editor mounted through a failed save, which rolls exists back
  // to false — without this the chooser would reappear over in-progress text.
  const [committed, setCommitted] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string | null>(null);
  const savingRef = useRef(false);

  // Serializing (never two saves in flight) keeps overlapping saves from
  // writing an older note over a newer one.
  const drainSaves = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      while (pendingRef.current !== null) {
        const pending = pendingRef.current;
        pendingRef.current = null;
        try {
          await upsertNoteAsync({ content: pending });
        } catch {
          // Requeue unless newer text arrived, then stop to avoid a hot loop.
          if (pendingRef.current === null) pendingRef.current = pending;
          break;
        }
      }
    } finally {
      savingRef.current = false;
    }
  }, [upsertNoteAsync]);

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

  // exists covers a persisted row; committed covers the current session
  // (survives a failed save that rolled exists back).
  if (!exists && !committed && hasTemplate) {
    return (
      <EmptyScreen message="Start this day's note">
        <Button
          variant="primary"
          style={styles.button}
          onPress={() => {
            setCommitted(true);
            upsertNote({ content: preferences.templateNote });
          }}
        >
          Use daily note template
        </Button>
        <Button
          variant="default"
          style={styles.button}
          onPress={() => {
            setCommitted(true);
            upsertNote({ content: "" });
          }}
        >
          Blank note
        </Button>
      </EmptyScreen>
    );
  }

  // Bundles the chrome decisions that only ever change together, rather than
  // three scattered ternaries in the JSX. Side gutter is the caller's either way.
  const chrome = card
    ? {
        wrapper: [styles.cardWrapper, { paddingTop: theme.space.md }],
        card: styles.card,
        backgroundColor: theme.colors.priorityMuted[ETaskPriority.NEITHER],
      }
    : {
        wrapper: styles.cardWrapper,
        card: [styles.card, styles.cardBorderless],
        backgroundColor: "transparent",
      };

  return (
    <View style={chrome.wrapper}>
      <View
        style={[
          chrome.card,
          {
            backgroundColor: chrome.backgroundColor,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
          },
        ]}
      >
        <NoteEditor
          initialValue={note.content}
          onChangeMarkdown={handleChangeMarkdown}
          onFocusChange={onEditingChange}
          placeholder="Write today's note…"
          testID="note-editor"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    flex: 1,
  },
  // Negative bottom margin pushes rounded corners past the screen edge for
  // the trail-off look; matching paddingBottom keeps content on-screen.
  card: {
    borderWidth: 1,
    flex: 1,
    marginBottom: -CARD_TRAIL_OFF,
    overflow: "hidden",
    paddingBottom: CARD_TRAIL_OFF,
  },
  // The large-screen tabbed pane already draws a border around the whole
  // column (see NotesJournalTabs), so the card's own border would double up.
  cardBorderless: {
    borderWidth: 0,
  },
  button: {
    minWidth: 240,
  },
});
