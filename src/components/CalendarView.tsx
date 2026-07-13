import { Temporal } from "@js-temporal/polyfill";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { TCalendarEvent } from "@/hooks/useCalendarEvents.types";
import { usePreferences } from "@/hooks/usePreferences";
import { layoutEvents } from "@/utils/calendarLayout";
import { formatHourLabel, formatTime, parseTimeToMinutes } from "@/utils/formatPlainTime";
import { useTheme, withOpacity } from "@/utils/theme";

/** Pixels per hour on the timeline. */
const HOUR_HEIGHT = 60;
/** Width reserved for the hour labels down the left edge. */
const GUTTER_WIDTH = 56;
/** Fallback window if stored times are missing or inverted. */
const DEFAULT_START_HOUR = 6;
const DEFAULT_END_HOUR = 20;

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
  const [preferences] = usePreferences();
  const [events, { isLoading, isError, permissionDenied }] =
    useCalendarEvents(date);

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
    () => layoutEvents(events, windowStartMin, windowEndMin, HOUR_HEIGHT),
    [events, windowStartMin, windowEndMin],
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
            <AllDayChip key={event.id} event={event} theme={theme} />
          ))}
        </View>
      )}

      {showEmpty ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            {emptyMessage}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
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
              {positioned.map(({ event, topPx, heightPx, columnIndex, columnCount }) => {
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
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={heightPx < 34 ? 1 : 2}
                      style={[styles.eventTitle, { color: theme.colors.text }]}
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
              })}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function AllDayChip({
  event,
  theme,
}: {
  event: TCalendarEvent;
  theme: ReturnType<typeof useTheme>;
}) {
  const accent = event.color ?? theme.colors.primary;
  return (
    <View
      style={[
        styles.allDayChip,
        {
          backgroundColor: withOpacity(accent, 0.16),
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  allDayBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  allDayChip: {
    paddingHorizontal: 10,
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
    paddingBottom: 24,
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
