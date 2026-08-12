import { Temporal } from "@js-temporal/polyfill";
import { useMemo, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedRef,
  useScrollViewOffset,
} from "react-native-reanimated";

import { duplicateTaskInput } from "@/api/tasks";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import {
  stageWindow,
  useHeroReveal,
  useStageOpacity,
} from "@/components/HeroLines";
import { RevealOnScroll, ScrollHint } from "@/components/ScrollReveal";
import { TaskCard } from "@/components/TaskCard";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { TCalendarEvent } from "@/hooks/useCalendarEvents.types";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import { useTaskDelete } from "@/hooks/useTaskDelete";
import { useTasks } from "@/hooks/useTasks";
import { calendarWindow, plannedMinutes } from "@/utils/calendarStats";
import { formatWeekday } from "@/utils/formatPlainDate";
import { formatTimeRange } from "@/utils/formatPlainTime";
import { selectTasksForDate } from "@/utils/taskFilters";
import { useTheme } from "@/utils/theme";
import {
  compareToTypical,
  copyToText,
  matchingWeekdaysBefore,
  sortAgenda,
  type TCopyTone,
  tomorrowCopy,
} from "@/utils/tomorrowPreview";

/**
 * The stage the content below the fold arrives on — the sentence, then the line
 * under it, then everything past the screen's edge together.
 *
 * Two text stages rather than the four `BODY_STAGE` assumes, because this hero
 * is a sentence and not a figure column. The driver still runs its full
 * `REVEAL_MS` with nothing left to fade after this window closes, which is
 * already what every step drawing fewer than four hero lines does.
 */
const BELOW_FOLD_STAGE = 2;

type TPreviewTomorrowStepProps = {
  /** The day being walked through — the ritual's date, not necessarily today. */
  date: Temporal.PlainDate;
};

/**
 * The evening ritual's Preview tomorrow step (DEX-149): a sentence on the shape
 * of the day after the one being closed out, and — a scroll below the fold — the
 * events and tasks it actually holds.
 *
 * **"Tomorrow" is the ritual's date plus one, not the wall clock's.** The word
 * is used literally in the copy, against the standing preference for naming the
 * day (see docs/features.md): the step is titled "Preview tomorrow" in the flow
 * itself, and the sentence names the weekday it compares against anyway, so a
 * ritual paged back to last Tuesday still reads as what it is. That rule exists
 * for the scheduling buttons, where the word would mis-file a task.
 *
 * **The task list is not the DEX-144 copy of the Today view.** That step drew a
 * second version of a list the reader could already see and was removed for it.
 * This one draws a day the Today tab is not showing, at the moment the reader is
 * deciding whether it is the day they want — the same axis the Open tasks step
 * (DEX-146) earns its own list on.
 *
 * Carries no side gutter and no top inset of its own; `SwipeablePage` and the
 * ritual layouts own those (see docs/design.md, "Who owns spacing").
 */
export function PreviewTomorrowStep({ date }: TPreviewTomorrowStepProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const largeScreen = useIsLargeDevice();
  const [preferences] = usePreferences();

  const tomorrow = useMemo(() => date.add({ days: 1 }), [date]);
  // The same arithmetic `TaskScheduleButton` defers with, one week at a time.
  const history = useMemo(() => matchingWeekdaysBefore(tomorrow), [tomorrow]);
  const [lastWeek, twoWeeks, threeWeeks, fourWeeks] = history;

  // **Five separate reads, and the count is fixed for the Rules of Hooks.**
  // `useCalendarEvents` takes one day and has no range form; four more calls
  // buy the history with none of the fetching, caching, permission or error
  // handling written twice, and React Query keys each day on its own so
  // re-walking the ritual costs nothing. The price is paid on web, where each
  // date re-fetches and re-parses the same `.ics` feed — worth revisiting with
  // a range parser if the feeds get large, not before.
  const [events, { isLoading: eventsLoading, isError, notConfigured }] =
    useCalendarEvents(tomorrow);
  const [lastWeekEvents, { isLoading: loading1, isError: error1 }] =
    useCalendarEvents(lastWeek);
  const [twoWeeksEvents, { isLoading: loading2, isError: error2 }] =
    useCalendarEvents(twoWeeks);
  const [threeWeeksEvents, { isLoading: loading3, isError: error3 }] =
    useCalendarEvents(threeWeeks);
  const [fourWeeksEvents, { isLoading: loading4, isError: error4 }] =
    useCalendarEvents(fourWeeks);

  const [allTasks, { isLoading: tasksLoading, updateTask, createTask }] =
    useTasks();
  // The repeat-aware delete the open tasks step, the review step and
  // `DayTaskList` all share, rather than `useTasks`' raw `deleteTask`.
  const { confirmDelete, confirmationProps } = useTaskDelete();

  // A calendar switched on with nothing behind it has nothing to preview and
  // nothing to compare, so it takes the same path as one switched off — rather
  // than the setup prompt the morning's Calendar step shows, which would be a
  // button stranded below the fold on a step nobody reaches to configure
  // anything.
  const showAgenda = preferences.enableCalendar && !notConfigured;

  // **A day that failed to load is not a day with nothing in it**, and the
  // comparison is where that distinction actually bites: an errored read hands
  // back an empty array, so a dropped connection would book tomorrow at zero
  // hours against a history that has some and tell the reader their day is
  // calmer than usual. Any of the five failing drops the meetings axis
  // entirely, which is what `null` already means to `tomorrowCopy` — the
  // sentence falls through to the tasks it does know about.
  const calendarError = isError || error1 || error2 || error3 || error4;
  // Only claimed when there is nothing to show for it: React Query serves the
  // last good array while a background refetch fails, and a cached day is still
  // worth drawing. Same guard the morning's Calendar step makes.
  const agendaFailed = isError && events.length === 0;

  const tasks = useMemo(
    () => selectTasksForDate(allTasks, tomorrow),
    [allTasks, tomorrow],
  );

  const agenda = useMemo(() => sortAgenda(events), [events]);

  // **The same clamped window on all five days**, so the comparison is like for
  // like: `plannedMinutes` measures against the hours the reader told us they
  // work, and a history measured over a different window would read as a change
  // in the day rather than in the setting.
  const taskLoad = useMemo(
    () =>
      compareToTypical(
        tasks.length,
        history.map((day) => selectTasksForDate(allTasks, day).length),
      ),
    [allTasks, history, tasks.length],
  );

  const eventLoad = useMemo(() => {
    if (!showAgenda || calendarError) return null;

    const { startMin, endMin } = calendarWindow(
      preferences.calendarStartTime,
      preferences.calendarEndTime,
    );
    const booked = (dayEvents: TCalendarEvent[], day: Temporal.PlainDate) =>
      plannedMinutes(dayEvents, day, startMin, endMin);

    return compareToTypical(booked(events, tomorrow), [
      booked(lastWeekEvents, lastWeek),
      booked(twoWeeksEvents, twoWeeks),
      booked(threeWeeksEvents, threeWeeks),
      booked(fourWeeksEvents, fourWeeks),
    ]);
  }, [
    calendarError,
    events,
    fourWeeks,
    fourWeeksEvents,
    lastWeek,
    lastWeekEvents,
    preferences.calendarEndTime,
    preferences.calendarStartTime,
    showAgenda,
    threeWeeks,
    threeWeeksEvents,
    tomorrow,
    twoWeeks,
    twoWeeksEvents,
  ]);

  const copy = tomorrowCopy(taskLoad, eventLoad, formatWeekday(tomorrow));

  const toneColor: Record<TCopyTone, string> = {
    plain: theme.colors.text,
    // A heavier tomorrow in `error` and a lighter one in `success` — sentiment,
    // where the evening's other reporting step deliberately refuses it. A review
    // of a day already lived would be passing a verdict on it; this is a day
    // still ahead, which is exactly when a reader can act on being warned.
    up: theme.colors.error,
    down: theme.colors.success,
  };

  // **Held back until all five days exist**, the history included. A sentence
  // that says "typical" and then rewrites itself as "busier" once the fourth
  // Thursday lands is worse than a beat of nothing, and the empty-history rule
  // in `compareToTypical` makes that flip the *likely* outcome rather than an
  // edge case. Nothing rather than a spinner, as every reporting step does.
  const isLoading =
    tasksLoading ||
    eventsLoading ||
    loading1 ||
    loading2 ||
    loading3 ||
    loading4;
  const reveal = useHeroReveal(isLoading ? null : tomorrow.toString());
  const sentenceStyle = useStageOpacity(reveal, 0);
  const followUpStyle = useStageOpacity(reveal, 1);
  const [belowFoldFrom, belowFoldTo] = stageWindow(BELOW_FOLD_STAGE);

  // Read straight off the scroller rather than through an `onScroll` handler, so
  // none of the scroll-driven fades below touches the JS thread.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);

  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  // How far this day can actually be scrolled — the one thing a block below
  // cannot work out from its own position (see `RevealOnScroll`).
  const maxScroll = Math.max(0, contentHeight - viewportHeight);

  if (isLoading) return null;

  const revealProps = {
    maxScroll,
    reveal,
    revealFrom: belowFoldFrom,
    revealTo: belowFoldTo,
    scrollOffset,
    viewportHeight,
  };

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        contentContainerStyle={{
          // The host SafeAreaView omits the bottom edge (the tab bar owns it),
          // so the inset belongs to the scroll content — which is what lets the
          // last card clear the translucent bar. Well past it on a large screen,
          // where the hero is a full viewport of mostly empty space: with only
          // enough padding to clear the bar the scroll runs out while that band
          // is still on screen and the last block ends pinned under the nav.
          paddingBottom: theme.space.lg * (largeScreen ? 6 : 2) + insets.bottom,
        }}
        onContentSizeChange={(_width, height) => setContentHeight(height)}
        onLayout={(event: LayoutChangeEvent) =>
          setViewportHeight(event.nativeEvent.layout.height)
        }
        ref={scrollRef}
        // The chevron already says there is more below, and it fades out as the
        // reader takes it up.
        showsVerticalScrollIndicator={false}
        testID="preview-tomorrow-scroll"
      >
        {/* One screenful, with the bottom inset taken out of it so the sentence
            centers in what the reader can see rather than in a box running
            behind the tab bar. `minHeight` rather than `height`: the first
            render has no measurement yet, and at 0 the hero is merely its
            natural size for a frame instead of collapsing. */}
        <View
          style={[
            styles.hero,
            {
              gap: theme.space.xs,
              minHeight: Math.max(0, viewportHeight - insets.bottom),
            },
          ]}
        >
          {/* One accessible node for the whole sentence: split across spans for
              the ink, it would otherwise be read out as a handful of orphaned
              fragments. The spans are nested `Text`, which is the only way a
              phrase mid-sentence takes its own color and still wraps with the
              rest of it. */}
          <Animated.Text
            accessibilityLabel={copyToText(copy.segments)}
            style={[
              styles.line,
              theme.fonts.heading,
              { color: theme.colors.text },
              sentenceStyle,
            ]}
            testID="preview-tomorrow-sentence"
          >
            {copy.segments.map((segment, index) => (
              <Text
                key={`${index}-${segment.text}`}
                style={{ color: toneColor[segment.tone] }}
              >
                {segment.text}
              </Text>
            ))}
          </Animated.Text>
          {copy.followUp ? (
            <Animated.Text
              style={[
                styles.line,
                theme.fonts.heading,
                { color: theme.colors.text },
                followUpStyle,
              ]}
            >
              {copy.followUp}
            </Animated.Text>
          ) : null}
          <ScrollHint
            color={theme.colors.textSecondary}
            reveal={reveal}
            revealFrom={belowFoldFrom}
            revealTo={belowFoldTo}
            scrollOffset={scrollOffset}
          />
        </View>

        {/* **Both blocks below are flat direct children of the scroller**, and
            that is load-bearing rather than tidy — see `RevealOnScroll` for what
            wrapping them would do to the measurement. The spacing between them
            is `marginTop` per block for the same reason. One measure's worth of
            room above the first, so the chevron reads as pointing past it rather
            than as its bullet. */}
        {showAgenda ? (
          <RevealOnScroll
            {...revealProps}
            style={{ gap: theme.space.sm, marginTop: theme.space.lg * 4 }}
          >
            {agenda.length === 0 ? (
              <Text
                style={[
                  theme.fonts.body,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {/* A dropped connection is not an empty day, and saying it is
                    would be the one claim on this step the reader has no way
                    to check. A plain message rather than the morning step's
                    "Set up calendars" button: nothing here is misconfigured. */}
                {agendaFailed
                  ? "Couldn't load your calendars"
                  : "No events tomorrow"}
              </Text>
            ) : (
              agenda.map((event) => <EventRow event={event} key={event.id} />)
            )}
          </RevealOnScroll>
        ) : null}

        <RevealOnScroll
          {...revealProps}
          style={{
            gap: theme.space.sm,
            // Two blocks of the same kind sit a section apart; the first block
            // is the one that needs the chevron's clearance.
            marginTop: showAgenda ? theme.space.lg * 2 : theme.space.lg * 4,
          }}
        >
          {tasks.length === 0 ? (
            <Text
              style={[theme.fonts.body, { color: theme.colors.textSecondary }]}
            >
              No tasks tomorrow
            </Text>
          ) : (
            tasks.map((task) => (
              // Plain `TaskCard`, not `DraggableTaskCard`: there is no
              // `DragScheduleProvider` above the ritual, so the draggable one
              // would degrade to exactly this anyway. Wired to the real
              // mutations the same way the review step wires its own.
              <TaskCard
                key={task.id}
                onDelete={() => void confirmDelete(task)}
                onDuplicate={() => createTask(duplicateTaskInput(task))}
                onPromoteSubtask={createTask}
                onUpdate={(diff) => updateTask({ id: task.id, ...diff })}
                task={task}
              />
            ))
          )}
        </RevealOnScroll>
      </Animated.ScrollView>
      {/* The repeat-aware delete's prompt. Outside the scroller: it is a modal,
          and a block that fades with the scroll is no place for one. */}
      <ConfirmationModal {...confirmationProps} />
    </View>
  );
}

/**
 * One line of the agenda: the source calendar's color, when the event runs, and
 * what it is.
 *
 * A dot rather than the inset bar `CalendarView` draws — the bar's job there is
 * to edge a block whose height means something, and in a list of rows there is
 * no block to edge. Same accent either way, and the same fallback for a source
 * that reports no color.
 */
function EventRow({ event }: { event: TCalendarEvent }) {
  const theme = useTheme();
  // The mark tracks the density tier without earning a token only this row would
  // read — the same derivation `CalendarView`'s now-dot makes.
  const size = theme.space.sm;
  const when = event.allDay
    ? "all-day"
    : formatTimeRange(event.start, event.end);

  return (
    <View
      accessible
      // One node for the whole row: split across three children it would be read
      // out as an orphaned time and then an orphaned title.
      accessibilityLabel={`${when} ${event.title}`}
      style={[styles.eventRow, { gap: theme.space.sm }]}
    >
      <View
        style={[
          styles.bullet,
          {
            backgroundColor: event.color ?? theme.colors.primary,
            borderRadius: theme.radii.full,
            height: size,
            width: size,
          },
        ]}
      />
      <Text
        style={[theme.fonts.body, { color: theme.colors.textSecondary }]}
        testID={`event-time-${event.id}`}
      >
        {when}
      </Text>
      {/* Takes the rest of the row so a long title wraps against the step's edge
          rather than against its own content, which keeps every row's title
          starting at the same x. */}
      <Text
        numberOfLines={2}
        style={[
          styles.eventTitle,
          theme.fonts.title,
          { color: theme.colors.text },
        ]}
      >
        {event.title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    alignItems: "center",
    justifyContent: "center",
  },
  line: { textAlign: "center" },
  eventRow: {
    // Centred against the dot rather than top-aligned: most rows are one line,
    // where hanging a dot from the top of the text reads as misaligned.
    alignItems: "center",
    flexDirection: "row",
  },
  bullet: {
    // Fixed by the size above; never squeezed by a long title beside it.
    flexShrink: 0,
  },
  eventTitle: { flex: 1 },
});
