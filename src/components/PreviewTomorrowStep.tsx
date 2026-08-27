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

// Two text stages, not the four BODY_STAGE assumes — this hero is a sentence,
// not a figure column.
const BELOW_FOLD_STAGE = 2;

type TPreviewTomorrowStepProps = {
  /** The day being walked through — the ritual's date, not necessarily today. */
  date: Temporal.PlainDate;
  /** Must be referentially stable — TaskCard's effect keys on its identity. */
  onEditingChange: (editing: boolean) => void;
};

/**
 * Evening ritual's Preview tomorrow step (DEX-149): a sentence on the day
 * ahead, then its events and tasks below the fold. "Tomorrow" is the ritual's
 * date plus one, not the wall clock's — an exception to naming the day, since
 * the step title and weekday name already disambiguate a paged-back ritual.
 */
export function PreviewTomorrowStep({
  date,
  onEditingChange,
}: TPreviewTomorrowStepProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const largeScreen = useIsLargeDevice();
  const [preferences] = usePreferences();

  const tomorrow = useMemo(() => date.add({ days: 1 }), [date]);
  const history = useMemo(() => matchingWeekdaysBefore(tomorrow), [tomorrow]);
  const [lastWeek, twoWeeks, threeWeeks, fourWeeks] = history;

  // Five calls (fixed count, Rules of Hooks) — useCalendarEvents has no
  // range form; re-parses each .ics feed on web, worth fixing only if it gets large.
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
  // The shared repeat-aware delete, not useTasks' raw deleteTask.
  const { confirmDelete, confirmationProps } = useTaskDelete();

  // A calendar with nothing behind it has nothing to preview or compare, so it
  // takes the off path rather than stranding a "Set up calendars" button here.
  const showAgenda = preferences.enableCalendar && !notConfigured;

  // An errored read hands back an empty array — drop the axis to null instead
  // of booking tomorrow at zero, which tomorrowCopy already falls through on.
  const calendarError = isError || error1 || error2 || error3 || error4;
  // Only claimed with nothing to show — React Query serves the last good
  // array through a failed background refetch, still worth drawing.
  const agendaFailed = isError && events.length === 0;

  const tasks = useMemo(
    () => selectTasksForDate(allTasks, tomorrow),
    [allTasks, tomorrow],
  );

  const agenda = useMemo(() => sortAgenda(events), [events]);

  // Same clamped window on all five days — a history measured over a
  // different window would read as a day change rather than a setting change.
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
    // Sentiment colors, unlike Review — a day still ahead is one the reader
    // can act on being warned about; a day already lived is not.
    up: theme.colors.error,
    down: theme.colors.success,
  };

  // Held back until all five days exist — a "typical" that rewrites itself to
  // "busier" once the history lands is worse than a beat of nothing.
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

  // Read straight off the scroller, not via onScroll, so scroll-driven fades
  // stay off the JS thread.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);

  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  // What a block below can't work out from its own position — see RevealOnScroll.
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
          // Host SafeAreaView omits the bottom edge; well past it on large
          // screens, or the scroll runs out with the last block under the nav.
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
        {/* One screenful minus the bottom inset, so the sentence centers in
            what's visible. minHeight not height, so an unmeasured first
            render collapses to natural size instead of to zero. */}
        <View
          style={[
            styles.hero,
            {
              gap: theme.space.xs,
              minHeight: Math.max(0, viewportHeight - insets.bottom),
              // Wraps the sentence as a stanza; the hero's own, agenda/cards
              // below want full width.
              paddingHorizontal: theme.space.lg,
            },
          ]}
        >
          {/* One accessible node — split spans read out as orphaned fragments.
              Nested Text is the only way a mid-sentence phrase colors and wraps. */}
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

        {/* Both blocks are flat direct children of the scroller — load-bearing
            for RevealOnScroll's measurement, hence marginTop over a wrapper. */}
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
                {/* Plain message, not the "Set up calendars" button — a
                    dropped connection isn't a misconfiguration. */}
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
            // Only the first block of this kind needs the chevron's clearance.
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
              // Plain TaskCard — no DragScheduleProvider above the ritual, and
              // onEditingChange matters here since these open tasks render fields.
              <TaskCard
                key={task.id}
                onDelete={() => void confirmDelete(task)}
                onDuplicate={() => createTask(duplicateTaskInput(task))}
                onEditingChange={onEditingChange}
                onPromoteSubtask={createTask}
                onUpdate={(diff) => updateTask({ id: task.id, ...diff })}
                task={task}
              />
            ))
          )}
        </RevealOnScroll>
      </Animated.ScrollView>
      {/* Outside the scroller — a modal has no business fading with scroll. */}
      <ConfirmationModal {...confirmationProps} />
    </View>
  );
}

// A dot, not CalendarView's inset bar — there's no block height to edge here.
function EventRow({ event }: { event: TCalendarEvent }) {
  const theme = useTheme();
  // Tracks the density tier without earning its own token — same derivation
  // as CalendarView's now-dot.
  const size = theme.space.sm;
  const when = event.allDay
    ? "all-day"
    : formatTimeRange(event.start, event.end);

  return (
    <View
      accessible
      // One node for the row — split children read as an orphaned time/title.
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
      {/* Takes the rest of the row so titles start at the same x. */}
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
    alignItems: "center",
    flexDirection: "row",
  },
  bullet: { flexShrink: 0 },
  eventTitle: { flex: 1 },
});
