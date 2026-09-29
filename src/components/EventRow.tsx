import { StyleSheet, Text, View } from "react-native";

import { TCalendarEvent } from "@/hooks/useCalendarEvents.types";
import { useUses24HourClock } from "@/hooks/useUses24HourClock";
import { formatTimeRange } from "@/utils/formatPlainTime";
import { useTheme } from "@/utils/theme";

type TEventRowProps = {
  event: TCalendarEvent;
  /** Ellipsizes the title to one line, for narrow Week columns (DEX-186). */
  compact?: boolean;
};

// A dot, not CalendarView's inset bar — there's no block height to edge here.
export function EventRow({ event, compact = false }: TEventRowProps) {
  const theme = useTheme();
  const uses24HourClock = useUses24HourClock();
  // Tracks the density tier without earning its own token — same derivation
  // as CalendarView's now-dot.
  const size = theme.space.sm;
  const when = event.allDay
    ? "all-day"
    : formatTimeRange(event.start, event.end, uses24HourClock);

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
        numberOfLines={1}
        style={[theme.fonts.body, { color: theme.colors.textSecondary }]}
        testID={`event-time-${event.id}`}
      >
        {when}
      </Text>
      {/* Takes the rest of the row so titles start at the same x. */}
      <Text
        numberOfLines={compact ? 1 : 2}
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
  eventRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  bullet: { flexShrink: 0 },
  eventTitle: { flex: 1 },
});
