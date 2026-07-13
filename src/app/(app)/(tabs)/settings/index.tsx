import { Redirect, useRouter } from "expo-router";
import { FlatList, StyleSheet, useWindowDimensions, View } from "react-native";

import { SettingsRow } from "@/components/SettingsRow";
import {
  SETTINGS_ITEMS,
  SETTINGS_TWO_PANE_MIN_WIDTH,
} from "@/utils/settingsItems";
import { useTheme, withOpacity } from "@/utils/theme";

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();

  // On wide screens the list becomes a persistent sidebar (SettingsSidebar) and
  // this index would otherwise render the same list again in the detail pane, so
  // redirect to a default subview and let the sidebar drive navigation.
  if (width >= SETTINGS_TWO_PANE_MIN_WIDTH) {
    return <Redirect href={`/settings/${SETTINGS_ITEMS[0].slug}`} />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <FlatList
        // Plain, ungrouped list: rows sit directly on the background, separated
        // by hairline dividers (no wrapping card).
        contentContainerStyle={{ paddingVertical: theme.spacing }}
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
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  screen: {
    flex: 1,
  },
});
