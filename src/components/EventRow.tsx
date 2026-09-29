import { StyleSheet, Text, View } from "react-native";

import { TCalendarEvent } from "@/hooks/useCalendarEvents.types";
import { formatTimeRange } from "@/utils/formatPlainTime";
import { useTheme } from "@/utils/theme";

type TEventRowProps = {
  event: TCalendarEvent;
  /** Time over a one-line, ellipsized title — for columns too narrow to fit
   * both on one row (Week, DEX-186). */
  compact?: boolean;
};

// A dot, not CalendarView's inset bar — there's no block height to edge here.
export function EventRow({ event, compact = false }: TEventRowProps) {
  const theme = useTheme();
  // Tracks the density tier without earning its own token — same derivation
  // as CalendarView's now-dot.
  const size = theme.space.sm;
  const gap = theme.space.sm;
  const when = event.allDay
    ? "all-day"
    : formatTimeRange(event.start, event.end);

  const bullet = (
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
  );
  const time = (
    <Text
      numberOfLines={compact ? 1 : undefined}
      style={[theme.fonts.body, { color: theme.colors.textSecondary }]}
      testID={`event-time-${event.id}`}
    >
      {when}
    </Text>
  );
  const titleStyle = [theme.fonts.title, { color: theme.colors.text }];

  return (
    <View
      accessible
      // One node for the row — split children read as an orphaned time/title.
      accessibilityLabel={`${when} ${event.title}`}
    >
      {compact ? (
        <>
          <View style={[styles.eventRow, { gap }]}>
            {bullet}
            {time}
          </View>
          {/* Indented past the dot so the title hangs under the time. */}
          <Text
            numberOfLines={1}
            style={[titleStyle, { marginLeft: size + gap }]}
          >
            {event.title}
          </Text>
        </>
      ) : (
        <View style={[styles.eventRow, { gap }]}>
          {bullet}
          {time}
          {/* Takes the rest of the row so titles start at the same x. */}
          <Text numberOfLines={2} style={[styles.eventTitle, ...titleStyle]}>
            {event.title}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  eventRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  bullet: { flexShrink: 0 },
  eventTitle: { flex: 1 },
});
