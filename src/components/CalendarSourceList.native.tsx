import { useQuery } from "@tanstack/react-query";
import * as Calendar from "expo-calendar";
import { StyleSheet, Switch, Text, View } from "react-native";

import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { useEnabledDeviceCalendars } from "@/hooks/useEnabledDeviceCalendars";
import { useTheme, withOpacity } from "@/utils/theme";

// Minimal structural shape for the calendars we render — decoupled from
// expo-calendar's exact exported type names.
type TDeviceCalendar = { id: string; title: string; color?: string };

type TCalendarsResult = {
  calendars: TDeviceCalendar[];
  permissionDenied: boolean;
};

const fetchCalendars = async (): Promise<TCalendarsResult> => {
  const { granted } = await Calendar.requestCalendarPermissions();
  if (!granted) {
    return { calendars: [], permissionDenied: true };
  }
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  return { calendars, permissionDenied: false };
};

/**
 * Native calendar sources: the device's own calendars, each with a toggle. The
 * selection is device-local (`useEnabledDeviceCalendars`); `null` means "not yet
 * customized", which shows everything. Toggling materializes the current set
 * before flipping one entry so "all enabled" becomes an explicit list.
 */
export function CalendarSourceList() {
  const theme = useTheme();
  const [enabledIds, { setEnabledIds }] = useEnabledDeviceCalendars();

  const { data } = useQuery({
    queryKey: ["deviceCalendars"],
    queryFn: fetchCalendars,
    staleTime: 1000 * 60 * 5,
  });
  const calendars = data?.calendars ?? [];
  const permissionDenied = data?.permissionDenied ?? false;

  const isEnabled = (id: string) =>
    enabledIds === null || enabledIds.includes(id);

  const toggle = (id: string) => {
    const base = enabledIds ?? calendars.map((c) => c.id);
    const next = base.includes(id)
      ? base.filter((existing) => existing !== id)
      : [...base, id];
    void setEnabledIds(next);
  };

  return (
    <View style={styles.section}>
      <SettingsSectionTitle>Calendars</SettingsSectionTitle>
      {permissionDenied ? (
        <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
          Calendar access is off. Enable it in your system settings to choose
          which calendars appear.
        </Text>
      ) : calendars.length === 0 ? (
        <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
          No calendars found on this device.
        </Text>
      ) : (
        <View style={{ gap: theme.gap }}>
          {calendars.map((calendar) => (
            <View
              key={calendar.id}
              style={[
                styles.row,
                {
                  backgroundColor: theme.colors.card,
                  borderRadius: theme.borderRadius,
                  opacity: isEnabled(calendar.id) ? 1 : 0.5,
                },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: calendar.color }]} />
              <Text
                numberOfLines={1}
                style={[styles.title, { color: theme.colors.text }]}
              >
                {calendar.title}
              </Text>
              <Switch
                accessibilityLabel={calendar.title}
                value={isEnabled(calendar.id)}
                onValueChange={() => toggle(calendar.id)}
                trackColor={{
                  true: theme.colors.primary,
                  false: withOpacity(theme.colors.text, 0.2),
                }}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    padding: 16,
  },
  dot: {
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  title: {
    flex: 1,
    fontSize: 16,
  },
  message: {
    fontSize: 14,
    paddingVertical: 8,
  },
});
