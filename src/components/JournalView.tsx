import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TJournal, TJournalPrompt } from "@/api/journals";
import { useJournals } from "@/hooks/useJournals";
import { promptPeriod } from "@/utils/journalPrompts";
import type { TMoodRating } from "@/utils/mood";
import type { TRitualMode } from "@/utils/ritualSteps";
import { useTheme } from "@/utils/theme";

import { EmptyScreen } from "./EmptyScreen";
import { LoadingScreen } from "./LoadingScreen";
import { MoodScale } from "./MoodScale";
import { TextInput } from "./TextInput";

type TJournalViewProps = {
  /** ISO date (YYYY-MM-DD) of the day whose journal is shown. */
  date: string;
  /** Which ritual is asking (DEX-151). Only this period's prompts render. */
  mode: TRitualMode;
  /** Fired on focus/blur so the host can disable day-swipe while editing. */
  onEditingChange?: (editing: boolean) => void;
};

// Long enough to coalesce keystrokes, short enough to be safe within a
// second of pausing. Matches NotesView.
const SAVE_DEBOUNCE_MS = 800;

// Approximate line height, used only for the field's pre-measurement start size.
const RESPONSE_LINE_HEIGHT = 20;

// A floor and first paint, not the real height — it counts hard newlines,
// not wrapped rows. The measured content (JournalResponseField) takes over.
const responseHeight = (lines: number, spacing: number) =>
  Math.max(1, lines) * RESPONSE_LINE_HEIGHT + spacing * 2;

// Autosaving journal surface for a day. Plain-text responses, unlike Notes'
// markdown editor, so it renders identically on web and native.
export function JournalView({
  date,
  mode,
  onEditingChange,
}: TJournalViewProps) {
  const [journal, { isLoading, exists, upsertJournal, upsertJournalAsync }] =
    useJournals(date);

  if (isLoading) return <LoadingScreen />;

  // A discrete choice has nothing to debounce, and it writes only its own
  // column — so it never races the editor's whole-array `prompts` save.
  const changeMood = (mood: TMoodRating) => upsertJournal({ mood });

  // Positions into the **stored** array — everything downstream indexes the
  // whole day, and only the render loop walks this list.
  const visible = journal.prompts.flatMap((entry, index) =>
    promptPeriod(entry) === mode ? [index] : [],
  );

  if (visible.length === 0) {
    // The scale still renders — a mood is the one thing this day can record.
    return (
      <EmptyScreen
        message={
          exists
            ? `This day was started before you had any ${mode === "pm" ? "evening" : "morning"} prompts.`
            : `Add ${mode === "pm" ? "an evening" : "a morning"} prompt in Settings → Ritual`
        }
      >
        <MoodScale value={journal.mood} onChange={changeMood} />
      </EmptyScreen>
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
      mood={journal.mood}
      onChangeMood={changeMood}
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
  mood: number | null;
  onChangeMood: (mood: TMoodRating) => void;
  upsertJournalAsync: (diff: {
    prompts: TJournalPrompt[];
  }) => Promise<TJournal>;
  onEditingChange?: (editing: boolean) => void;
};

function JournalEditor({
  prompts,
  visible,
  mood,
  onChangeMood,
  upsertJournalAsync,
  onEditingChange,
}: TJournalEditorProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Seeded once at mount; the editor remounts whenever prompt labels change.
  const responsesRef = useRef(prompts.map((p) => p.response));

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<TJournalPrompt[] | null>(null);
  const savingRef = useRef(false);

  // Serializing (never two saves in flight) keeps overlapping saves from
  // writing older responses over newer ones. Mirrors NotesView.
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
          // Requeue unless newer text arrived, then stop to avoid a hot loop.
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
      // Rebuild from the whole day, not the rendered subset, or the other
      // ritual's answers are lost — upsertJournal replaces the whole column.
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

  // A date change unmounts a focused field without a reliable onBlur, which
  // would otherwise leave day-swipe suspended. Mirrors NoteEditor.
  useEffect(() => () => onEditingChange?.(false), [onEditingChange]);

  return (
    <ScrollView
      style={styles.scroll}
      // Insets content by the keyboard height on iOS (DEX-92). Don't pair
      // with a frame-padding wrapper — both would subtract the keyboard.
      automaticallyAdjustKeyboardInsets
      // Vertical only — side gutter is the caller's; bottom reserved here
      // since the host's SafeAreaView omits it (docs/design.md, docs/frontend.md).
      contentContainerStyle={{
        gap: theme.space.lg,
        paddingTop: theme.space.md,
        paddingBottom: theme.space.md + insets.bottom,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {/* The extra margin sets the scale apart from the prompts it scores. */}
      <View style={{ marginBottom: theme.space.md }}>
        <MoodScale value={mood} onChange={onChangeMood} />
      </View>
      {/* index is a position in the stored array, not on screen. */}
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

// Grows rather than scrolling (the step's ScrollView scrolls); minHeight,
// never height — scrollEnabled={false} clamps content size and clips typing.
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

  // Uncontrolled input — response never updates after mount, so its newline
  // count as a permanent floor would keep a cleared answer's box tall.
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
