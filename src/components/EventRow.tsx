import { StyleSheet, Text, View } from "react-native";

import { TCalendarEvent } from "@/hooks/useCalendarEvents.types";
import { formatTimeRange } from "@/utils/formatPlainTime";
import { useTheme } from "@/utils/theme";

// A dot, not CalendarView's inset bar — there's no block height to edge here.
export function EventRow({ event }: { event: TCalendarEvent }) {
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
  eventRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  bullet: { flexShrink: 0 },
  eventTitle: { flex: 1 },
});
