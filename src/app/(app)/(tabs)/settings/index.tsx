import { useRouter } from "expo-router";
import { SymbolViewProps } from "expo-symbols";
import { FlatList, StyleSheet, View } from "react-native";

import { SettingsRow } from "@/components/SettingsRow";
import { useTheme, withOpacity } from "@/utils/theme";

type TSettingsItem = {
  slug: string;
  title: string;
  subtitle: string;
  icon: SymbolViewProps["name"];
};

// Each item navigates to a subview under `/settings/<slug>` (registered in
// _layout.tsx). Most are placeholders today; Account houses Log Out.
const SETTINGS_ITEMS: TSettingsItem[] = [
  {
    slug: "account",
    title: "Account",
    subtitle: "Manage your account and sign out",
    icon: "person.crop.circle",
  },
  {
    slug: "appearance",
    title: "Appearance",
    subtitle: "Theme and display options",
    icon: "paintbrush",
  },
  {
    slug: "tasks",
    title: "Tasks",
    subtitle: "Task defaults and behavior",
    icon: "checklist",
  },
  {
    slug: "calendars",
    title: "Calendars",
    subtitle: "Connected calendars",
    icon: "calendar",
  },
  {
    slug: "habits",
    title: "Habits",
    subtitle: "Habit tracking preferences",
    icon: "repeat",
  },
  {
    slug: "journal",
    title: "Journal",
    subtitle: "Journaling preferences",
    icon: "book",
  },
  {
    slug: "notes",
    title: "Notes",
    subtitle: "Notes preferences",
    icon: "note.text",
  },
  {
    slug: "licenses",
    title: "Licenses",
    subtitle: "Open source licenses",
    icon: "doc.text",
  },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: theme.colors.background, padding: theme.spacing },
      ]}
    >
      <FlatList
        // The content container is the grouped card: a single rounded, clipped
        // surface. Individual rows draw their own hairline dividers.
        contentContainerStyle={[
          styles.card,
          {
            backgroundColor: theme.colors.card,
            borderRadius: theme.borderRadius,
            borderColor: withOpacity(theme.colors.text, 0.1),
          },
        ]}
        data={SETTINGS_ITEMS}
        keyExtractor={(item) => item.slug}
        ItemSeparatorComponent={() => (
          <View
            style={[
              styles.divider,
              { backgroundColor: withOpacity(theme.colors.text, 0.1) },
            ]}
          />
        )}
        renderItem={({ item }) => (
          <SettingsRow
            icon={item.icon}
            title={item.title}
            subtitle={item.subtitle}
            onPress={() => router.push(`/settings/${item.slug}`)}
            testID={`settings-row-${item.slug}`}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  screen: {
    flex: 1,
  },
});
