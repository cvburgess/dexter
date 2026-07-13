import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CalendarSourceList } from "@/components/CalendarSourceList";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { TimeField } from "@/components/TimeField";
import { usePreferences } from "@/hooks/usePreferences";
import { SETTINGS_TWO_PANE_MIN_WIDTH } from "@/utils/settingsItems";
import { useTheme, withOpacity } from "@/utils/theme";

// Preferences store the daily window as Postgres `time` (`"HH:MM:SS"`), while
// TimeField speaks `"HH:MM"`.
const toFieldValue = (stored: string) => stored.slice(0, 5);
const toStoredValue = (field: string) => `${field}:00`;

export default function CalendarsScreen() {
  const theme = useTheme();
  const [preferences, { updatePreferences }] = usePreferences();
  const { width } = useWindowDimensions();
  // See account.tsx: the sidebar absorbs the left inset in two-pane mode.
  const twoPane = width >= SETTINGS_TWO_PANE_MIN_WIDTH;

  return (
    <SafeAreaView
      edges={twoPane ? ["bottom", "right"] : ["bottom", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { padding: theme.spacing, gap: theme.spacing },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.toggle}>
          <Text style={[styles.toggleLabel, { color: theme.colors.text }]}>
            Calendar
          </Text>
          <Switch
            accessibilityLabel="Calendar"
            value={preferences.enableCalendar}
            onValueChange={(enableCalendar) =>
              updatePreferences({ enableCalendar })
            }
            trackColor={{
              true: theme.colors.primary,
              false: withOpacity(theme.colors.text, 0.2),
            }}
          />
        </View>

        {preferences.enableCalendar && (
          <>
            <View style={styles.section}>
              <SettingsSectionTitle>Daily timeline</SettingsSectionTitle>
              <View style={styles.timeRow}>
                <Text style={[styles.timeLabel, { color: theme.colors.text }]}>
                  Start time
                </Text>
                <TimeField
                  accentColor={theme.colors.primary}
                  testID="calendar-start-time"
                  value={toFieldValue(preferences.calendarStartTime)}
                  onChange={(value) =>
                    updatePreferences({ calendarStartTime: toStoredValue(value) })
                  }
                />
              </View>
              <View style={styles.timeRow}>
                <Text style={[styles.timeLabel, { color: theme.colors.text }]}>
                  End time
                </Text>
                <TimeField
                  accentColor={theme.colors.primary}
                  testID="calendar-end-time"
                  value={toFieldValue(preferences.calendarEndTime)}
                  onChange={(value) =>
                    updatePreferences({ calendarEndTime: toStoredValue(value) })
                  }
                />
              </View>
            </View>

            <CalendarSourceList />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  section: {
    gap: 10,
  },
  timeRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 40,
  },
  timeLabel: {
    fontSize: 16,
  },
  toggle: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
});
