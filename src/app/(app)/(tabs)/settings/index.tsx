import { Redirect, useRouter } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";

import { SettingsRow } from "@/components/SettingsRow";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import { SETTINGS_ITEMS } from "@/utils/settingsItems";
import { useTheme } from "@/utils/theme";

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const twoPane = useIsMultiPane();

  // On wide screens the list becomes a persistent sidebar (SettingsSidebar) and
  // this index would otherwise render the same list again in the detail pane, so
  // redirect to a default subview and let the sidebar drive navigation.
  if (twoPane) {
    return <Redirect href={`/settings/${SETTINGS_ITEMS[0].slug}`} />;
  }

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: theme.colors.background, padding: theme.spacing },
      ]}
    >
      <FlatList
        // Ungrouped: each item is its own card, separated by margin (rather than
        // sharing a single grouped surface).
        contentContainerStyle={{ gap: theme.gap }}
        data={SETTINGS_ITEMS}
        keyExtractor={(item) => item.slug}
        renderItem={({ item }) => (
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.card,
                borderRadius: theme.borderRadius,
              },
            ]}
          >
            <SettingsRow
              icon={item.icon}
              title={item.title}
              subtitle={item.subtitle}
              onPress={() => router.push(`/settings/${item.slug}`)}
              testID={`settings-row-${item.slug}`}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
  },
  screen: {
    flex: 1,
  },
});
