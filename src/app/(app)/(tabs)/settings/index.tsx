import { Redirect, useRouter } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { SettingsRow } from "@/components/SettingsRow";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { SETTINGS_ITEMS } from "@/utils/settingsItems";
import { EDGES_SINGLE_PANE } from "@/utils/settingsSafeAreaEdges";
import { useTheme } from "@/utils/theme";

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const twoPane = useIsLargeDevice();
  const insets = useSafeAreaInsets();

  // On wide screens the list becomes a persistent sidebar (SettingsSidebar) and
  // this index would otherwise render the same list again in the detail pane, so
  // redirect to a default subview and let the sidebar drive navigation.
  if (twoPane) {
    return <Redirect href={`/settings/${SETTINGS_ITEMS[0].slug}`} />;
  }

  return (
    // This screen only ever renders single-pane (the wide layout redirects
    // above), so it takes the single-pane edges unconditionally.
    <SafeAreaView
      edges={EDGES_SINGLE_PANE}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <FlatList
        // Ungrouped: each item is its own card, separated by margin (rather than
        // sharing a single grouped surface).
        // `paddingBottom` adds the safe-area inset to the list's own padding:
        // the edges above omit `bottom` so rows scroll under the translucent
        // tab bar, and this is what lets the last one clear it (DEX-91).
        contentContainerStyle={{
          gap: theme.space.sm,
          padding: theme.space.md,
          paddingBottom: theme.space.md + insets.bottom,
        }}
        data={SETTINGS_ITEMS}
        keyExtractor={(item) => item.slug}
        renderItem={({ item }) => (
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.card,
                borderRadius: theme.radii.md,
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
    </SafeAreaView>
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
