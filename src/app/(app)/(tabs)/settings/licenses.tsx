import { FlatList, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import packageJson from "@/package.json";
import licensesJson from "@/utils/licenses.json";
import {
  EDGES_SINGLE_PANE,
  EDGES_TWO_PANE,
} from "@/utils/settingsSafeAreaEdges";
import { useTheme } from "@/utils/theme";

const licenses = licensesJson as Record<string, string>;

type TLicenseItem = {
  name: string;
  license: string;
};

export default function LicensesScreen() {
  const theme = useTheme();
  const twoPane = useIsLargeDevice();
  const insets = useSafeAreaInsets();

  // Combine dependencies and devDependencies, sort alphabetically, and look up
  // each license from the generated map (see `npm run licenses`). Deriving the
  // list from package.json means a stale licenses.json still shows every current
  // package — just "Unknown" for any not yet regenerated.
  const allDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const sortedDependencies: TLicenseItem[] = Object.keys(allDependencies)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, license: licenses[name] || "Unknown" }));

  const renderItem = ({ item }: { item: TLicenseItem }) => (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: theme.radii.md,
        padding: theme.space.md,
      }}
    >
      <Text
        style={[
          theme.fonts.title,
          { marginBottom: theme.space.xs },
          { color: theme.colors.text },
        ]}
      >
        {item.name}
      </Text>
      <Text
        style={[
          theme.fonts.body,
          { marginTop: theme.space.xs },
          { color: theme.colors.textSecondary },
        ]}
      >
        License: {item.license}
      </Text>
    </View>
  );

  const ListHeaderComponent = () => (
    <View style={{ marginBottom: theme.space.sm }}>
      <Text
        style={[
          theme.fonts.body,
          styles.description,
          { color: theme.colors.textSecondary },
        ]}
      >
        This app uses the following open source libraries:
      </Text>
    </View>
  );

  return (
    <SafeAreaView
      edges={twoPane ? EDGES_TWO_PANE : EDGES_SINGLE_PANE}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <FlatList
        data={sortedDependencies}
        renderItem={renderItem}
        keyExtractor={(item) => item.name}
        ListHeaderComponent={ListHeaderComponent}
        // `paddingBottom` adds the safe-area inset to the list's own padding —
        // the edges above omit `bottom` so rows scroll under the tab bar
        // (DEX-91).
        contentContainerStyle={{
          gap: theme.space.sm,
          padding: theme.space.md,
          paddingBottom: theme.space.md + insets.bottom,
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  description: {
    lineHeight: 20,
  },
});
