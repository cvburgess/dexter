import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ETaskPriority } from "@/api/tasks";
import { useDays } from "@/hooks/useDays";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme, withOpacity } from "@/utils/theme";

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
  /**
   * Whether to inset the card with the small-screen gutter (16pt top/sides)
   * and draw its own tinted background/border. The large-screen
   * multi-column layout passes `false` so the card sits flush and transparent
   * within its own column instead of floating with extra margin and a card
   * color that would double up on the tabbed pane's own border (see
   * NotesJournalTabs).
   */
  inset?: boolean;
};

// Autosave cadence: long enough to coalesce a burst of keystrokes into one
// write, short enough that a note is safe within a second of pausing.
const SAVE_DEBOUNCE_MS = 800;

// How far the note card's background/border overhang the bottom screen edge for
// the "trails off" look. Applied as both a negative margin (visual overhang) and
// a matching bottom padding (keeps the editor content on-screen).
const CARD_TRAIL_OFF = 24;

/**
 * The Notes surface for a single day. Reads/writes the day's markdown note via
 * `useDays`, autosaving edits (debounced). When the day has no note row yet and
 * a daily-note template is configured, it first offers the user a choice
 * between seeding the template and starting blank; both choices write a row, so
 * the choice persists across remounts/tab switches instead of re-prompting
 * (DEX-37). Remount this per-date (via `key`) so the editor re-seeds when the
 * day changes.
 */
export function NotesView({
  date,
  onEditingChange,
  inset = true,
}: TNotesViewProps) {
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
      <EmptyScreen message="Start this day's note">
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
      </EmptyScreen>
    );
  }

  // Experiment: sit the note on a card styled like an incomplete "Neither"
  // task (TaskCard: priority color at 80%, content color at 10% for the
  // border), inset with the same 16pt gutter as the task list.
  const priorityColor = theme.colors.priority[ETaskPriority.NEITHER];
  const contentColor = theme.colors.priorityContent[ETaskPriority.NEITHER];

  // `inset` bundles three chrome decisions that only ever change together —
  // derive them here once rather than three scattered ternaries in the JSX.
  const chrome = inset
    ? {
        wrapper: styles.cardWrapper,
        card: styles.card,
        backgroundColor: withOpacity(priorityColor, 0.8),
      }
    : {
        wrapper: [styles.cardWrapper, styles.cardWrapperFlush],
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
            borderColor: withOpacity(contentColor, 0.1),
            borderRadius: theme.borderRadius,
          },
        ]}
      >
        <NoteEditor
          initialValue={day.notes ?? ""}
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
  // Same 16pt gutter the task list uses (today/index.tsx `list`) on the top and
  // sides — but no bottom gutter, so the card runs to the bottom edge.
  cardWrapper: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  // The large-screen layout already gives every pane its own column gutter
  // (see today/index.tsx), so the card runs flush there instead of doubling
  // up on inset.
  cardWrapperFlush: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  // Matches TaskCard's container: theme radius, 1pt border, clipped corners. The
  // editor's own 16pt padding supplies the inner padding (TaskCard uses 16).
  // The negative bottom margin pushes the rounded bottom corners past the screen
  // edge so the card looks like it trails off rather than ending in the viewport;
  // the matching paddingBottom keeps the editor *content* on-screen (only the
  // bg/border overhang) so the editor can still scroll its last lines into view.
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
