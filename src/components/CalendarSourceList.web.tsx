import Ionicons from "@react-native-vector-icons/ionicons";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Button } from "@/components/Button";
import { SettingsSectionTitle } from "@/components/SettingsSectionTitle";
import { TextInput } from "@/components/TextInput";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/utils/theme";

/**
 * Web calendar sources: a list of public `.ics` feed URLs, persisted to
 * `preferences.calendarUrls`. Mirrors the Journal-prompts editor
 * (`settings/journal.tsx`): edits commit on blur, structural add/delete write
 * the whole array, and `drafts` is the authoritative array so a structural edit
 * never builds on the optimistically-lagging preference.
 */
export function CalendarSourceList() {
  const theme = useTheme();
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

  return (
    <View style={styles.section}>
      <SettingsSectionTitle>Calendar feeds</SettingsSectionTitle>
      {drafts.length === 0 ? (
        <Text style={[styles.empty, { color: theme.colors.textSecondary }]}>
          Add a public .ics feed URL to see its events on the timeline.
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
              style={styles.input}
              value={url}
            />
            <TouchableOpacity
              accessibilityLabel={`Delete feed ${index + 1}`}
              accessibilityRole="button"
              onPress={() => deleteUrl(index)}
              style={styles.delete}
              testID={`delete-feed-${index}`}
            >
              <Ionicons color={theme.colors.error} name="trash-outline" size={22} />
            </TouchableOpacity>
          </View>
        ))
      )}
      <Button variant="default" onPress={addUrl}>
        Add feed
      </Button>
      <Text style={[styles.hint, { color: theme.colors.textSecondary }]}>
        Use a secret/private URL when your provider offers one.
      </Text>
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
    gap: 8,
  },
  input: {
    flex: 1,
  },
  delete: {
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  empty: {
    fontSize: 14,
    paddingVertical: 8,
  },
  hint: {
    fontSize: 13,
  },
});
