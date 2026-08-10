import { useNavigation } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { HeaderAddButton } from "@/components/HeaderAddButton";
import { RowDeleteButton, rowDeleteInset } from "@/components/RowDeleteButton";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { TextInput } from "@/components/TextInput";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/utils/theme";

/**
 * Web calendar sources: a list of public `.ics` feed URLs, persisted to
 * `preferences.calendarUrls`. Mirrors the Journal-prompts editor
 * (`settings/ritual.tsx`): edits commit on blur, structural add/delete write
 * the whole array, and `drafts` is the authoritative array so a structural edit
 * never builds on the optimistically-lagging preference.
 */
export function CalendarSourceList() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [preferences, { updatePreferences }] = usePreferences();

  const [drafts, setDrafts] = useState(preferences.calendarUrls);
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setDrafts(preferences.calendarUrls);
  }, [preferences.calendarUrls]);

  const commitUrl = () => {
    focusedRef.current = false;
    const changed =
      drafts.length !== preferences.calendarUrls.length ||
      drafts.some((draft, i) => draft !== preferences.calendarUrls[i]);
    if (changed) updatePreferences({ calendarUrls: drafts });
  };

  const writeUrls = (next: string[]) => {
    setDrafts(next);
    updatePreferences({ calendarUrls: next });
  };

  const addUrl = () => writeUrls([...drafts, ""]);
  const deleteUrl = (index: number) =>
    writeUrls(drafts.filter((_, i) => i !== index));

  // A "+" in the header adds a feed, matching Habits and Journal. Wired from
  // here rather than from `settings/calendars.tsx` because the drafts array
  // this appends to lives here — and because the screen also renders on native,
  // where there are no feeds to add. Re-wired on every render so the handler
  // closes over the latest drafts; cleared on unmount, which is what the other
  // two express as `visible` — this list only mounts while Calendar is on, so
  // toggling it off must take the affordance with it.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <HeaderAddButton
          accessibilityLabel="Add feed"
          onPress={addUrl}
          testID="add-feed-button"
        />
      ),
    });
    return () => navigation.setOptions({ headerRight: undefined });
  });

  return (
    <View style={{ gap: theme.space.sm }}>
      <SettingsSectionTitle subtitle="Use a secret/private URL when your provider offers one.">
        Calendar feeds
      </SettingsSectionTitle>
      {drafts.length === 0 ? (
        <Text
          style={[
            theme.fonts.body,
            {
              color: theme.colors.textSecondary,
              paddingVertical: theme.space.sm,
            },
          ]}
        >
          Tap ＋ to add a public .ics feed URL and see its events on the
          timeline.
        </Text>
      ) : (
        drafts.map((url, index) => (
          <View key={index} style={styles.row}>
            <TextInput
              accessibilityLabel={`Calendar feed ${index + 1}`}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onBlur={commitUrl}
              onChangeText={(text) =>
                setDrafts((current) =>
                  current.map((u, i) => (i === index ? text : u)),
                )
              }
              onFocus={() => (focusedRef.current = true)}
              placeholder="https://example.com/calendar.ics"
              style={{ paddingRight: rowDeleteInset(theme) }}
              value={url}
            />
            <RowDeleteButton
              accessibilityLabel={`Delete feed ${index + 1}`}
              onPress={() => deleteUrl(index)}
              testID={`delete-feed-${index}`}
            />
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // The anchor `RowDeleteButton` parks against; the field fills it.
  row: {
    justifyContent: "center",
    position: "relative",
  },
});
