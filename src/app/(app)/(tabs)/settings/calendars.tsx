import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { CalendarSourceList } from "@/components/CalendarSourceList";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { SettingsToggleCard } from "@/components/SettingsToggleCard";
import { TimeField } from "@/components/TimeField";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import {
  EDGES_SINGLE_PANE,
  EDGES_TWO_PANE,
} from "@/utils/settingsSafeAreaEdges";
import { useTheme } from "@/utils/theme";

// Preferences store the daily window as Postgres `time` (`"HH:MM:SS"`), while
// TimeField speaks `"HH:MM"`.
const toFieldValue = (stored: string) => stored.slice(0, 5);
const toStoredValue = (field: string) => `${field}:00`;

export default function CalendarsScreen() {
  const theme = useTheme();
  const [preferences, { updatePreferences }] = usePreferences();
  // See account.tsx: the sidebar absorbs the left inset in two-pane mode.
  const twoPane = useIsLargeDevice();
  const insets = useSafeAreaInsets();

  const cardStyle = {
    backgroundColor: theme.colors.surfaceSunken,
    borderRadius: theme.radii.md,
  };

  return (
    <SafeAreaView
      edges={twoPane ? EDGES_TWO_PANE : EDGES_SINGLE_PANE}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        // Edges omit `bottom`; the content padding lets the last row clear
        // the translucent tab bar (DEX-91).
        contentContainerStyle={[
          styles.content,
          {
            padding: theme.space.md,
            paddingBottom: theme.space.md + insets.bottom,
            gap: theme.space.sm,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <SettingsToggleCard
          label="Calendar"
          value={preferences.enableCalendar}
          onValueChange={(enableCalendar) =>
            updatePreferences({ enableCalendar })
          }
        />

        {preferences.enableCalendar && (
          <>
            <View style={{ gap: theme.space.sm }}>
              <SettingsSectionTitle>Daily timeline</SettingsSectionTitle>
              <View style={{ gap: theme.space.sm }}>
                <View
                  style={[
                    styles.timeRow,
                    { padding: theme.space.md },
                    cardStyle,
                  ]}
                >
                  <Text
                    style={[theme.fonts.title, { color: theme.colors.text }]}
                  >
                    Start time
                  </Text>
                  <TimeField
                    accentColor={theme.colors.primary}
                    testID="calendar-start-time"
                    value={toFieldValue(preferences.calendarStartTime)}
                    onChange={(value) =>
                      // The web time input can emit "" when cleared; ignore it
                      // rather than storing the invalid ":00" (`time` rejects it).
                      value &&
                      updatePreferences({
                        calendarStartTime: toStoredValue(value),
                      })
                    }
                  />
                </View>
                <View
                  style={[
                    styles.timeRow,
                    { padding: theme.space.md },
                    cardStyle,
                  ]}
                >
                  <Text
                    style={[theme.fonts.title, { color: theme.colors.text }]}
                  >
                    End time
                  </Text>
                  <TimeField
                    accentColor={theme.colors.primary}
                    testID="calendar-end-time"
                    value={toFieldValue(preferences.calendarEndTime)}
                    onChange={(value) =>
                      value &&
                      updatePreferences({
                        calendarEndTime: toStoredValue(value),
                      })
                    }
                  />
                </View>
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
  timeRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
