import { Temporal } from "@js-temporal/polyfill";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import {
  TCalendarEvent,
  TEventResponse,
} from "@/hooks/useCalendarEvents.types";
import { usePreferences } from "@/hooks/usePreferences";
import {
  layoutEvents,
  nowLineTopPx,
  scrollOffsetForTarget,
  TPositionedEvent,
} from "@/utils/calendarLayout";
import { calendarWindow } from "@/utils/calendarStats";
import { formatHourLabel, formatTime } from "@/utils/formatPlainTime";
import { useTheme, withOpacity } from "@/utils/theme";

import { EmptyScreen } from "./EmptyScreen";

/** Pixels per hour on the timeline. */
const HOUR_HEIGHT = 72;
/** Width reserved for the hour labels down the left edge. */
const GUTTER_WIDTH = 50;
/** Timeline right inset and gutter right padding — part of the fixed
 * coordinate system below, not the spacing scale (DEX-61). */
const GUTTER_INSET = 8;
/** Diameter of the dot capping the "now" line. */
const NOW_DOT_SIZE = 8;
/** Blocks at least this tall stack the time under the title; shorter ones
 * render it inline. Half an hour at the current scale. */
const STACKED_MIN_HEIGHT = HOUR_HEIGHT / 2;
/** Only blocks this tall have room for a two-line title above the time. */
const TWO_LINE_TITLE_MIN_HEIGHT = 50;
/** Floor for very short blocks so a single inline line stays legible. */
const MIN_EVENT_HEIGHT = 20;
/**
 * Hairline gap shaved off each block's bottom so back-to-back events (e.g. 1–2
 * and 2–3) render with a sliver between them instead of touching edge-to-edge,
 * where their rounded corners read as one event overlapping the next.
 */
const EVENT_GAP = 2;
/** Accent-fill opacity by RSVP: tentative reads faint, invited is outline-only
 * (transparent), so neither is mistaken for an accepted commitment. */
const NORMAL_FILL_OPACITY = 0.16;
const RESPONSE_FILL_OPACITY: Partial<Record<TEventResponse, number>> = {
  tentative: 0.08,
  invited: 0,
};
const fillOpacity = (response?: TEventResponse): number =>
  (response && RESPONSE_FILL_OPACITY[response]) ?? NORMAL_FILL_OPACITY;

/** Invited events add a 1px accent outline so the hollow block still reads
 * as a complete card (Apple Calendar's treatment for unaccepted events). */
const borderStyle = (accent: string, response?: TEventResponse): ViewStyle =>
  response === "invited" ? { borderColor: accent, borderWidth: 1 } : {};

/** Full-opacity accent bar inset inside an event's rectangle. */
function AccentBar({
  accent,
  theme,
}: {
  accent: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View
      style={[
        styles.accentBar,
        {
          backgroundColor: accent,
          bottom: theme.space.xs,
          left: theme.space.xs,
          top: theme.space.xs,
        },
      ]}
    />
  );
}
/** How often the "now" line / past-event dimming re-evaluates. */
const NOW_REFRESH_MS = 60_000;
/** Padding above the first hour, inside the scroll content. */
const SCROLL_TOP_PADDING = 12;
/** Padding below the last hour (plus the bottom safe-area inset at runtime). */
const SCROLL_BOTTOM_PADDING = 24;

/** Minutes from `date`'s midnight to now — in `[0, 1440]` today, `>1440` on
 * a past day, negative on a future one — driving both the now-line and the
 * past-event flag from one value. */
const nowMinutesFromDayStart = (date: Temporal.PlainDate): number =>
  Temporal.Now.plainDateTimeISO()
    .since(date.toPlainDateTime(), { largestUnit: "minute" })
    .total({ unit: "minute" });

type TCalendarViewProps = {
  date: Temporal.PlainDate;
};

/** The Today-tab timeline: all-day events pinned above the scroll, timed
 * events laid out with overlaps split into columns (`utils/calendarLayout`). */
export function CalendarView({ date }: TCalendarViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [preferences] = usePreferences();
  const [events, { isLoading, isError, permissionDenied, notConfigured }] =
    useCalendarEvents(date);

  // Refreshed on an interval so the now-line advances and events dim as they
  // end; `date` is stable per mount (SwipeablePage remounts per day).
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

  // Snapped to whole hours in `calendarWindow`, which the Calendar step also
  // reads so its "Nh free" measures against the same window drawn here.
  const {
    startHour,
    endHour,
    startMin: windowStartMin,
    endMin: windowEndMin,
  } = useMemo(
    () =>
      calendarWindow(
        preferences.calendarStartTime,
        preferences.calendarEndTime,
      ),
    [preferences.calendarStartTime, preferences.calendarEndTime],
  );

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
        MIN_EVENT_HEIGHT,
      ),
    [events, date, windowStartMin, windowEndMin, nowMinutes],
  );

  const nowTopPx = nowLineTopPx(
    nowMinutes,
    windowStartMin,
    windowEndMin,
    HOUR_HEIGHT,
  );

  // Anchors the now line in the upper third on first layout; the view remounts
  // per day, so this covers both "view loads" and "day changed" once each.
  const scrollRef = useRef<ScrollView>(null);
  const didScrollToNowRef = useRef(false);
  const scrollToNow = (event: LayoutChangeEvent) => {
    if (didScrollToNowRef.current || nowTopPx === null) return;
    const viewportHeight = event.nativeEvent.layout.height;
    const contentHeight =
      totalHeight + SCROLL_TOP_PADDING + SCROLL_BOTTOM_PADDING + insets.bottom;
    const y = scrollOffsetForTarget(
      nowTopPx + SCROLL_TOP_PADDING,
      viewportHeight,
      contentHeight,
    );
    scrollRef.current?.scrollTo({ y, animated: false });
    didScrollToNowRef.current = true;
  };

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let hour = startHour; hour <= endHour; hour++) list.push(hour);
    return list;
  }, [startHour, endHour]);

  const dividerColor = withOpacity(theme.colors.text, 0.25);

  // Ordered most specific first — `notConfigured` ahead of the generic
  // message, or "no calendar" was being told their day was clear.
  const emptyMessage = permissionDenied
    ? "Calendar access is off. Enable it in your system settings to see your events."
    : isError
      ? "Couldn't load your calendars. Check your connection or feed URLs."
      : notConfigured
        ? "No calendars yet. Add one in Settings → Calendars to see your events."
        : "No events scheduled for this day.";

  const showEmpty =
    !isLoading && allDayEvents.length === 0 && positioned.length === 0;

  return (
    // Bottom-up so the scroller is the first child UIKit's minimize-walk
    // finds (DEX-136) while the all-day bar still renders above it.
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        // Empty state renders inside this scroller (DEX-136); keyed so
        // remounting doesn't burn scrollToNow's one shot for nothing.
        key={showEmpty ? "empty" : "timeline"}
        onLayout={showEmpty ? undefined : scrollToNow}
        contentContainerStyle={
          showEmpty
            ? styles.emptyContent
            : [
                styles.scrollContent,
                // Host SafeAreaView omits `bottom` (the tab bar owns it), so
                // add the inset here or the last hour hides behind it.
                { paddingBottom: SCROLL_BOTTOM_PADDING + insets.bottom },
              ]
        }
        showsVerticalScrollIndicator={false}
        testID="calendar-scroll"
      >
        {showEmpty ? (
          <EmptyScreen message={emptyMessage} />
        ) : (
          <View style={{ height: totalHeight }}>
            {hours.map((hour) => (
              <HourRow
                key={hour}
                hour={hour}
                top={(hour - startHour) * HOUR_HEIGHT}
                dividerColor={dividerColor}
                theme={theme}
              />
            ))}

            <View style={styles.eventsArea}>
              {positioned.map((p) => (
                <EventBlock key={p.event.id} positioned={p} theme={theme} />
              ))}
            </View>

            {nowTopPx !== null && <NowLine top={nowTopPx} theme={theme} />}
          </View>
        )}
      </ScrollView>

      {allDayEvents.length > 0 && (
        <View
          style={[
            styles.allDayBar,
            {
              borderBottomColor: dividerColor,
              gap: theme.space.xs,
              paddingVertical: theme.space.sm,
            },
          ]}
        >
          {allDayEvents.map((event) => (
            <AllDayRow key={event.id} event={event} theme={theme} />
          ))}
        </View>
      )}
    </View>
  );
}

function HourRow({
  hour,
  top,
  dividerColor,
  theme,
}: {
  hour: number;
  top: number;
  dividerColor: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View>
      <Text
        // One line, always: the label is centered on its own line by half its
        // font size, so a wrap would overlap the hour below.
        numberOfLines={1}
        style={[
          styles.hourLabel,
          theme.fonts.subtitle,
          {
            // Derived from the role, not fixed, or the two drift apart when
            // the density tier changes the font size.
            top: top - Math.round(theme.fonts.subtitle.fontSize / 2),
            color: theme.colors.textSecondary,
          },
        ]}
      >
        {formatHourLabel(hour)}
      </Text>
      <View style={[styles.hourLine, { top, backgroundColor: dividerColor }]} />
    </View>
  );
}

function EventBlock({
  positioned,
  theme,
}: {
  positioned: TPositionedEvent;
  theme: ReturnType<typeof useTheme>;
}) {
  const { event, topPx, heightPx, columnIndex, columnCount, isPast } =
    positioned;
  const accent = event.color ?? theme.colors.primary;
  // Tall enough to stack the time under the title; otherwise the time rides
  // inline to the right of a single-line title.
  const stacked = heightPx >= STACKED_MIN_HEIGHT;

  return (
    <View
      style={[
        styles.eventBlock,
        {
          paddingLeft: theme.space.md,
          paddingRight: theme.space.sm,
          // Short blocks can't spare the full vertical padding.
          paddingVertical: stacked ? theme.space.xs : 1,
        },
        {
          top: topPx,
          height: heightPx - EVENT_GAP,
          left: `${(columnIndex / columnCount) * 100}%`,
          width: `${(1 / columnCount) * 100}%`,
          backgroundColor: withOpacity(accent, fillOpacity(event.response)),
          ...borderStyle(accent, event.response),
          borderRadius: theme.radii.md,
          // Dim events that have already ended, matching the disabled
          // treatment used in settings lists.
          opacity: isPast ? 0.5 : 1,
        },
      ]}
    >
      <AccentBar accent={accent} theme={theme} />
      {stacked ? (
        <>
          <Text
            numberOfLines={heightPx >= TWO_LINE_TITLE_MIN_HEIGHT ? 2 : 1}
            style={[theme.fonts.body, { color: theme.colors.text }]}
          >
            {event.title}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              theme.fonts.subtitle,
              styles.eventSecondary,
              { color: theme.colors.textSecondary },
            ]}
          >
            {formatTime(event.start)}
          </Text>
        </>
      ) : (
        <View style={styles.eventInlineRow}>
          <Text
            numberOfLines={1}
            style={[
              theme.fonts.body,
              styles.eventTitleInline,
              { color: theme.colors.text },
            ]}
          >
            {event.title}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              theme.fonts.subtitle,
              styles.eventSecondary,
              styles.eventTimeInline,
              { color: theme.colors.textSecondary, marginLeft: theme.space.xs },
            ]}
          >
            {formatTime(event.start)}
          </Text>
        </View>
      )}
    </View>
  );
}

function NowLine({
  top,
  theme,
}: {
  top: number;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View pointerEvents="none" style={[styles.nowLineRow, { top }]}>
      <View
        style={[
          styles.nowDot,
          {
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radii.full,
          },
        ]}
      />
      <View
        style={[styles.nowLine, { backgroundColor: theme.colors.primary }]}
      />
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
        style={[
          theme.fonts.subtitle,
          styles.allDayGutter,
          { color: theme.colors.textSecondary },
        ]}
      >
        all-day
      </Text>
      <View
        style={[
          styles.allDayBlock,
          {
            backgroundColor: withOpacity(accent, fillOpacity(event.response)),
            ...borderStyle(accent, event.response),
            borderRadius: theme.radii.md,
            paddingLeft: theme.space.md,
            paddingRight: theme.space.xs,
            paddingVertical: theme.space.xs,
          },
        ]}
      >
        <AccentBar accent={accent} theme={theme} />
        <Text
          numberOfLines={1}
          style={[theme.fonts.body, { color: theme.colors.text }]}
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
    flexDirection: "column-reverse",
  },
  allDayBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Lets the empty state fill the viewport so it centres in it, which a content
  // container sized to its (empty) content would not.
  emptyContent: {
    flexGrow: 1,
  },
  allDayRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  // Full gutter width so the all-day block lines up with the timeline events
  // (which start at GUTTER_WIDTH), rather than starting 8px further left.
  allDayGutter: {
    paddingRight: GUTTER_INSET,
    textAlign: "right",
    width: GUTTER_WIDTH,
  },
  // Left padding leaves room for the inset accent bar (see `accentBar`).
  allDayBlock: {
    flex: 1,
    marginRight: GUTTER_INSET,
    overflow: "hidden",
  },
  scrollContent: {
    paddingTop: SCROLL_TOP_PADDING,
  },
  hourLabel: {
    left: 0,
    position: "absolute",
    textAlign: "right",
    width: GUTTER_WIDTH - GUTTER_INSET,
  },
  hourLine: {
    height: StyleSheet.hairlineWidth,
    left: GUTTER_WIDTH,
    position: "absolute",
    right: GUTTER_INSET,
  },
  // Zero-height row at "now"; alignItems center makes the dot and line
  // straddle it, spanning from left of the gutter to the hour lines' edge.
  nowLineRow: {
    alignItems: "center",
    flexDirection: "row",
    height: 0,
    left: GUTTER_WIDTH - NOW_DOT_SIZE / 2,
    position: "absolute",
    right: GUTTER_INSET,
  },
  nowDot: {
    height: NOW_DOT_SIZE,
    width: NOW_DOT_SIZE,
  },
  nowLine: {
    borderRadius: 1,
    flex: 1,
    height: 2,
    // Pull the line back under the dot so it starts at the gutter edge,
    // aligning with the hour lines.
    marginLeft: -NOW_DOT_SIZE / 2,
  },
  // Positioned over the gridlines; event blocks are absolute within it, so their
  // percentage widths divide this area (the space right of the hour gutter).
  eventsArea: {
    bottom: 0,
    left: GUTTER_WIDTH,
    position: "absolute",
    right: GUTTER_INSET,
    top: 0,
  },
  // Left padding leaves room for the inset accent bar (see `accentBar`).
  eventBlock: {
    overflow: "hidden",
    position: "absolute",
  },
  // Its width and corner are decorative marks, not points on the radius
  // scale — see docs/design.md.
  accentBar: {
    borderRadius: 2,
    position: "absolute",
    width: 3,
  },
  // The time reads as secondary to the title it sits with, dimmed rather than
  // set a step smaller — both are already at the smallest type role.
  eventSecondary: {
    fontWeight: "400",
  },
  // Short blocks: title and time share one row, time just right of the title.
  eventInlineRow: {
    alignItems: "baseline",
    flexDirection: "row",
  },
  eventTitleInline: {
    flexShrink: 1, // truncate the title, don't push the time off-block
  },
  eventTimeInline: {
    flexShrink: 0, // the pair above only works if the clock itself can't shrink
  },
});
