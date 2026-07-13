import { Temporal } from "@js-temporal/polyfill";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { TCalendarEvent } from "@/hooks/useCalendarEvents.types";
import { usePreferences } from "@/hooks/usePreferences";
import { layoutEvents, nowLineTopPx } from "@/utils/calendarLayout";
import {
  formatHourLabel,
  formatTime,
  parseTimeToMinutes,
} from "@/utils/formatPlainTime";
import { useTheme, withOpacity } from "@/utils/theme";

/** Pixels per hour on the timeline. */
const HOUR_HEIGHT = 60;
/** Width reserved for the hour labels down the left edge. */
const GUTTER_WIDTH = 56;
/** Fallback window if stored times are missing or inverted. */
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 20;
/** How often the "now" line / past-event dimming re-evaluates. */
const NOW_REFRESH_MS = 60_000;

/**
 * Minutes from `date`'s midnight to the current moment. Inside `[0, 1440]` on
 * today, `>1440` on a past day, and negative on a future day — which is what
 * lets the same value drive the now-line position and the past-event flag.
 */
const nowMinutesFromDayStart = (date: Temporal.PlainDate): number =>
  Temporal.Now.plainDateTimeISO()
    .since(date.toPlainDateTime(), { largestUnit: "minute" })
    .total({ unit: "minute" });

type TCalendarViewProps = {
  date: Temporal.PlainDate;
};

/**
 * The Today-tab Calendar surface: the day's events on a themed, scrollable
 * vertical timeline bounded by the user's configured start/end hours. All-day
 * events are pinned in a header above the scroll; timed events are laid out on
 * the timeline with overlaps split into side-by-side columns
 * (`utils/calendarLayout`). The event source is platform-specific (device
 * calendars on native, proxied `.ics` feeds on web) but this view is agnostic.
 */
export function CalendarView({ date }: TCalendarViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [preferences] = usePreferences();
  const [events, { isLoading, isError, permissionDenied }] =
    useCalendarEvents(date);

  // Minutes-from-midnight of "now" relative to the viewed day, refreshed on an
  // interval so the now-line advances and events dim as they end. Seeded from
  // the initializer — SwipeableDay remounts this view per date, so `date` is
  // stable for the component's lifetime and needs no in-effect re-seed.
  const [nowMinutes, setNowMinutes] = useState(() =>
    nowMinutesFromDayStart(date),
  );
  useEffect(() => {
    const id = setInterval(
      () => setNowMinutes(nowMinutesFromDayStart(date)),
      NOW_REFRESH_MS,
    );
    return () => clearInterval(id);
  }, [date]);

  // Snap the window to whole hours: the start/end preferences name the first
  // and last hours shown. Fall back to a sane default if unset or inverted.
  const { startHour, endHour } = useMemo(() => {
    const start = Math.floor(
      parseTimeToMinutes(preferences.calendarStartTime) / 60,
    );
    const end = Math.ceil(parseTimeToMinutes(preferences.calendarEndTime) / 60);
    if (!(end > start)) {
      return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR };
    }
    return { startHour: start, endHour: end };
  }, [preferences.calendarStartTime, preferences.calendarEndTime]);

  const windowStartMin = startHour * 60;
  const windowEndMin = endHour * 60;
  const totalHeight = ((windowEndMin - windowStartMin) / 60) * HOUR_HEIGHT;

  const allDayEvents = useMemo(
    () => events.filter((event) => event.allDay),
    [events],
  );

  const positioned = useMemo(
    () =>
      layoutEvents(
        events,
        date,
        windowStartMin,
        windowEndMin,
        HOUR_HEIGHT,
        nowMinutes,
      ),
    [events, date, windowStartMin, windowEndMin, nowMinutes],
  );

  const nowTopPx = nowLineTopPx(
    nowMinutes,
    windowStartMin,
    windowEndMin,
    HOUR_HEIGHT,
  );

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let hour = startHour; hour <= endHour; hour++) list.push(hour);
    return list;
  }, [startHour, endHour]);

  const dividerColor = withOpacity(theme.colors.text, 0.1);

  const emptyMessage = permissionDenied
    ? "Calendar access is off. Enable it in your system settings to see your events."
    : isError
      ? "Couldn't load your calendars. Check your connection or feed URLs."
      : "No events scheduled for this day.";

  const showEmpty =
    !isLoading && allDayEvents.length === 0 && positioned.length === 0;

  return (
    <View style={styles.container}>
      {allDayEvents.length > 0 && (
        <View style={[styles.allDayBar, { borderBottomColor: dividerColor }]}>
          {allDayEvents.map((event) => (
            <AllDayRow key={event.id} event={event} theme={theme} />
          ))}
        </View>
      )}

      {showEmpty ? (
        <View style={styles.emptyContainer}>
          <Text
            style={[styles.emptyText, { color: theme.colors.textSecondary }]}
          >
            {emptyMessage}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            // The host SafeAreaView omits the bottom edge (the native tab bar
            // owns it), so add the inset here or the last hour hides behind it.
            { paddingBottom: 24 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ height: totalHeight }}>
            {hours.map((hour) => {
              const top = (hour - startHour) * HOUR_HEIGHT;
              return (
                <View key={hour}>
                  <Text
                    style={[
                      styles.hourLabel,
                      { top: top - 7, color: theme.colors.textSecondary },
                    ]}
                  >
                    {formatHourLabel(hour)}
                  </Text>
                  <View
                    style={[
                      styles.hourLine,
                      { top, backgroundColor: dividerColor },
                    ]}
                  />
                </View>
              );
            })}

            <View style={styles.eventsArea}>
              {positioned.map(
                ({
                  event,
                  topPx,
                  heightPx,
                  columnIndex,
                  columnCount,
                  isPast,
                }) => {
                  const accent = event.color ?? theme.colors.primary;
                  return (
                    <View
                      key={event.id}
                      style={[
                        styles.eventBlock,
                        {
                          top: topPx,
                          height: heightPx,
                          left: `${(columnIndex / columnCount) * 100}%`,
                          width: `${(1 / columnCount) * 100}%`,
                          backgroundColor: withOpacity(accent, 0.16),
                          borderLeftColor: accent,
                          borderRadius: theme.borderRadius,
                          // Dim events that have already ended, matching the
                          // disabled treatment used in settings lists.
                          opacity: isPast ? 0.5 : 1,
                        },
                      ]}
                    >
                      <Text
                        numberOfLines={heightPx < 34 ? 1 : 2}
                        style={[
                          styles.eventTitle,
                          { color: theme.colors.text },
                        ]}
                      >
                        {event.title}
                      </Text>
                      {heightPx >= 34 && (
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.eventTime,
                            { color: theme.colors.textSecondary },
                          ]}
                        >
                          {formatTime(event.start)}
                        </Text>
                      )}
                    </View>
                  );
                },
              )}
            </View>

            {nowTopPx !== null && (
              <View
                pointerEvents="none"
                style={[styles.nowLineRow, { top: nowTopPx }]}
              >
                <View
                  style={[
                    styles.nowDot,
                    { backgroundColor: theme.colors.primary },
                  ]}
                />
                <View
                  style={[
                    styles.nowLine,
                    { backgroundColor: theme.colors.primary },
                  ]}
                />
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function AllDayRow({
  event,
  theme,
}: {
  event: TCalendarEvent;
  theme: ReturnType<typeof useTheme>;
}) {
  const accent = event.color ?? theme.colors.primary;
  return (
    <View style={styles.allDayRow}>
      <Text
        numberOfLines={1}
        style={[styles.allDayGutter, { color: theme.colors.textSecondary }]}
      >
        All Day
      </Text>
      <View
        style={[
          styles.allDayBlock,
          {
            backgroundColor: withOpacity(accent, 0.16),
            borderLeftColor: accent,
            borderRadius: theme.borderRadius,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.allDayText, { color: theme.colors.text }]}
        >
          {event.title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  allDayBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
    paddingVertical: 8,
  },
  allDayRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  allDayGutter: {
    fontSize: 11,
    paddingRight: 8,
    textAlign: "right",
    width: GUTTER_WIDTH - 8,
  },
  allDayBlock: {
    borderLeftWidth: 3,
    flex: 1,
    marginRight: 8,
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  allDayText: {
    fontSize: 13,
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  scrollContent: {
    paddingTop: 12,
  },
  hourLabel: {
    fontSize: 11,
    left: 0,
    position: "absolute",
    textAlign: "right",
    width: GUTTER_WIDTH - 8,
  },
  hourLine: {
    height: StyleSheet.hairlineWidth,
    left: GUTTER_WIDTH,
    position: "absolute",
    right: 8,
  },
  // Zero-height row whose top edge sits exactly at "now"; alignItems center
  // makes the dot and line straddle that line. Spans from just left of the
  // gutter (for the dot) to the same right edge as the hour lines.
  nowLineRow: {
    alignItems: "center",
    flexDirection: "row",
    height: 0,
    left: GUTTER_WIDTH - 4,
    position: "absolute",
    right: 8,
  },
  nowDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  nowLine: {
    borderRadius: 1,
    flex: 1,
    height: 2,
    // Pull the line back under the dot so it starts at the gutter edge,
    // aligning with the hour lines.
    marginLeft: -4,
  },
  // Positioned over the gridlines; event blocks are absolute within it, so their
  // percentage widths divide this area (the space right of the hour gutter).
  eventsArea: {
    bottom: 0,
    left: GUTTER_WIDTH,
    position: "absolute",
    right: 8,
    top: 0,
  },
  eventBlock: {
    borderLeftWidth: 3,
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 2,
    position: "absolute",
  },
  eventTitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  eventTime: {
    fontSize: 11,
  },
});
