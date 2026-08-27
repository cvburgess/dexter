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

  // Wide screens get the list as a persistent sidebar, so redirect to a
  // default subview rather than render the same list again in the pane.
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
        // Ungrouped cards; edges omit `bottom` so this padding lets the
        // last row clear the translucent tab bar (DEX-91).
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
                backgroundColor: theme.colors.surfaceSunken,
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
