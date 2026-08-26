import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TJournal, TJournalPrompt } from "@/api/journals";
import { useJournals } from "@/hooks/useJournals";
import { promptPeriod } from "@/utils/journalPrompts";
import type { TRitualMode } from "@/utils/ritualSteps";
import { useTheme } from "@/utils/theme";

import { EmptyScreen } from "./EmptyScreen";
import { LoadingScreen } from "./LoadingScreen";
import { TextInput } from "./TextInput";

type TJournalViewProps = {
  /** ISO date (YYYY-MM-DD) of the day whose journal is shown. */
  date: string;
  /** Which ritual is asking (DEX-151). Only this period's prompts render. */
  mode: TRitualMode;
  /** Fired as a response field gains/loses focus, so the host can disable
   * day-swipe while editing. */
  onEditingChange?: (editing: boolean) => void;
};

// Autosave cadence: long enough to coalesce a burst of keystrokes into one
// write, short enough that a response is safe within a second of pausing.
// Matches NotesView.
const SAVE_DEBOUNCE_MS = 800;

// Approximate line height for the response field's 16px font. Only ever used
// for the size a field starts at, before it has measured itself — a short
// answer shouldn't render as a tall empty box that's more likely to sit under
// the keyboard.
const RESPONSE_LINE_HEIGHT = 20;

// Height for `lines` lines of response text, including the shared TextInput's
// own vertical padding.
//
// This is a **floor and a first paint**, not the real height: it counts hard
// newlines, so it has no idea how many rows a long paragraph wraps onto. The
// height that matters comes from the field measuring its own content (see
// `JournalResponseField`). Keeping the estimate as the floor is what stops a
// missing or zero measurement from collapsing a field to nothing.
const responseHeight = (lines: number, spacing: number) =>
  Math.max(1, lines) * RESPONSE_LINE_HEIGHT + spacing * 2;

/**
 * The Journal surface for a single day. Reads/writes the day's reflection
 * prompts via `useJournals`, autosaving edits (debounced). Responses are plain
 * text (unlike Notes' markdown editor), so this renders identically on web and
 * native. Prompts auto-seed from `preferences.templatePrompts` (via
 * `useJournals`' `defaultJournal`), so there is no template chooser — nothing
 * persists until the user answers. Remounted per date by `SwipeablePage` (keyed
 * on the day), which re-seeds the uncontrolled inputs when the day changes.
 */
export function JournalView({
  date,
  mode,
  onEditingChange,
}: TJournalViewProps) {
  const [journal, { isLoading, exists, upsertJournalAsync }] =
    useJournals(date);

  if (isLoading) return <LoadingScreen />;

  // Positions into the **stored** array — everything downstream indexes the
  // whole day, and only the render loop walks this list.
  const visible = journal.prompts.flatMap((entry, index) =>
    promptPeriod(entry) === mode ? [index] : [],
  );

  if (visible.length === 0) {
    // Two different nothings: an existing day predates this ritual's prompts,
    // a missing one means the template has none (rare — `stepsFor` drops it).
    return (
      <EmptyScreen
        message={
          exists
            ? `This day was started before you had any ${mode === "pm" ? "evening" : "morning"} prompts.`
            : `Add ${mode === "pm" ? "an evening" : "a morning"} prompt in Settings → Ritual`
        }
      />
    );
  }

  // Keyed on each label and its period so a template change re-seeds a
  // still-mounted editor; response-only edits keep both, so autosaves don't remount.
  return (
    <JournalEditor
      key={JSON.stringify(
        journal.prompts.map((p) => [p.prompt, promptPeriod(p)]),
      )}
      prompts={journal.prompts}
      visible={visible}
      upsertJournalAsync={upsertJournalAsync}
      onEditingChange={onEditingChange}
    />
  );
}

type TJournalEditorProps = {
  /** **The whole day**, never the rendered subset. See `handleChangeResponse`. */
  prompts: TJournalPrompt[];
  /** Indices into `prompts` to render: the ritual on screen's own. */
  visible: number[];
  upsertJournalAsync: (diff: {
    prompts: TJournalPrompt[];
  }) => Promise<TJournal>;
  onEditingChange?: (editing: boolean) => void;
};

function JournalEditor({
  prompts,
  visible,
  upsertJournalAsync,
  onEditingChange,
}: TJournalEditorProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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
  // mutate is referentially stable, so closing over `upsertJournalAsync` is
  // stable.
  const drainSaves = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      while (pendingRef.current !== null) {
        const pending = pendingRef.current;
        pendingRef.current = null;
        try {
          await upsertJournalAsync({ prompts: pending });
        } catch {
          // Retries (in useJournals) are exhausted. Requeue unless newer text
          // already arrived, then stop so we don't hot-loop a persistent
          // failure — the next edit/unmount flush retries.
          if (pendingRef.current === null) pendingRef.current = pending;
          break;
        }
      }
    } finally {
      savingRef.current = false;
    }
  }, [upsertJournalAsync]);

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
      // `upsertJournal` replaces the whole jsonb column, so rebuild from `prompts`
      // — the whole day, not the rendered subset, or the other ritual's answers go.
      pendingRef.current = prompts.map((prompt, i) => ({
        prompt: prompt.prompt,
        period: prompt.period,
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
    <ScrollView
      style={styles.scroll}
      // Insets the content by the keyboard's height (iOS) so a focused field
      // low on the screen is scrolled clear of it rather than left covered.
      // Android resizes the window instead (Expo's default
      // softwareKeyboardLayoutMode), and web has no overlay keyboard. Matches
      // new-task.tsx and settings/tasks/[id].tsx (DEX-92). This replaced an
      // animated wrapper that padded the scroller's *frame* by the keyboard
      // height: that gave scroll room past the last field but never moved
      // content, so the field stayed under the keyboard. Don't reintroduce it
      // alongside this prop — the two would both subtract the keyboard.
      automaticallyAdjustKeyboardInsets
      // Vertical only — the side gutter is the caller's (`SwipeablePage` on the
      // phone, the Journal branch of `NotesJournalTabs` in the tabbed pane);
      // see docs/design.md, "Who owns spacing".
      //
      // The host's SafeAreaView omits "bottom" (the tab bar owns that inset),
      // so the content reserves it here — see docs/frontend.md.
      contentContainerStyle={{
        gap: theme.space.lg,
        paddingTop: theme.space.md,
        paddingBottom: theme.space.md + insets.bottom,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {/* `index` is a position in the **stored** array, not on screen — the same
          number `handleChangeResponse`, `responsesRef` and the testID use. */}
      {visible.map((index) => (
        <JournalResponseField
          key={index}
          prompt={prompts[index].prompt}
          response={prompts[index].response}
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

// A single prompt + response row.
//
// **The field grows rather than scrolling.** A response is prose the user is
// writing, so a box that hides the top of it behind its own scrollbar is the
// wrong shape entirely; the step's own `ScrollView` is what scrolls. The height
// tracks the input's **measured** content, which is the only thing that knows
// how tall wrapped text renders — an earlier cut counted `\n`s, so a long
// paragraph typed without a single Enter stayed one line tall. That estimate
// survives as the floor (see `responseHeight`) so nothing collapses before the
// first measurement lands.
//
// **`minHeight`, never `height`.** On the new architecture a multiline
// `TextInput` measures its own text and grows with it — but only while nothing
// pins it. An explicit `height` wins over that intrinsic size, which left the
// field frozen at whatever the single mount-time measurement reported: right
// for text that was already saved, and stuck scrolling for everything typed
// afterwards. As a floor it composes instead of competing, and it is what web
// needs, where `react-native-web` renders a plain `<textarea>` that has no
// intrinsic growth of its own.
//
// **Do not add `scrollEnabled={false}` to "enforce" the no-scrolling part.** It
// does the opposite: with scrolling off, iOS reports a content size clamped to
// the view's own bounds, so `onContentSizeChange` only ever echoes back the
// height already set here. Paired with `overflow: hidden` that silently clips
// what the user is typing. Growth is what removes the scrollbar — there is
// nothing to scroll once the box fits its content.
function JournalResponseField({
  prompt,
  response,
  onBlur,
  onChangeText,
  onFocus,
  testID,
}: TJournalResponseFieldProps) {
  const theme = useTheme();
  const [contentHeight, setContentHeight] = useState(0);

  // The seed is only good until the field has measured itself. `response` is
  // the saved answer at mount and never changes after it — the input is
  // uncontrolled and typing writes refs rather than state — so keeping its
  // newline count as the floor would leave a five-line answer's box five lines
  // tall after the user cleared it. Once a measurement exists it takes over,
  // and one line is the only floor still worth holding.
  const minHeight =
    contentHeight > 0
      ? Math.max(responseHeight(1, theme.space.md), contentHeight)
      : responseHeight(response.split("\n").length, theme.space.md);

  return (
    <View style={{ gap: theme.space.sm }}>
      <Text style={[theme.fonts.title, { color: theme.colors.text }]}>
        {prompt}
      </Text>
      <TextInput
        accessibilityLabel={prompt}
        defaultValue={response}
        multiline
        onBlur={onBlur}
        onChangeText={onChangeText}
        // Fires whenever the wrapped content's size changes, which is the only
        // thing that knows how tall the text actually renders.
        onContentSizeChange={(event) =>
          setContentHeight(event.nativeEvent.contentSize.height)
        }
        onFocus={onFocus}
        placeholder="Write your response…"
        style={{ minHeight }}
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
});
