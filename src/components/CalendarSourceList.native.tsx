import { useQuery } from "@tanstack/react-query";
import * as Calendar from "expo-calendar";
import { StyleSheet, Switch, Text, View } from "react-native";

import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { useEnabledDeviceCalendars } from "@/hooks/useEnabledDeviceCalendars";
import { useTheme, withOpacity } from "@/utils/theme";

type TCalendarsResult = {
  calendars: Calendar.Calendar[];
  permissionDenied: boolean;
};

const fetchCalendars = async (): Promise<TCalendarsResult> => {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== Calendar.PermissionStatus.GRANTED) {
    return { calendars: [], permissionDenied: true };
  }
  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );
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

  const dividerColor = withOpacity(theme.colors.text, 0.1);

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
        <View
          style={[
            styles.list,
            {
              backgroundColor: theme.colors.card,
              borderRadius: theme.borderRadius,
            },
          ]}
        >
          {calendars.map((calendar, index) => (
            <View
              key={calendar.id}
              style={[
                styles.row,
                index > 0 && {
                  borderTopColor: dividerColor,
                  borderTopWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View
                style={[styles.dot, { backgroundColor: calendar.color }]}
              />
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
  list: {
    overflow: "hidden",
    paddingHorizontal: 16,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
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
