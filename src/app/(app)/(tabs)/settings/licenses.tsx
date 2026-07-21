import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import packageJson from "@/package.json";
import licensesJson from "@/utils/licenses.json";
import { useTheme } from "@/utils/theme";

const licenses = licensesJson as Record<string, string>;

// See account.tsx: the sidebar absorbs the left inset in two-pane mode.
// Hoisted so SafeAreaView's internal edges useMemo sees a stable reference.
const EDGES_SINGLE_PANE = ["bottom", "left", "right"] as const;
const EDGES_TWO_PANE = ["bottom", "right"] as const;

type TLicenseItem = {
  name: string;
  license: string;
};

export default function LicensesScreen() {
  const theme = useTheme();
  const twoPane = useIsMultiPane();

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
        borderRadius: theme.borderRadius,
        padding: theme.spacing,
      }}
    >
      <Text style={[styles.licenseName, { color: theme.colors.text }]}>
        {item.name}
      </Text>
      <Text style={[styles.licenseType, { color: theme.colors.textSecondary }]}>
        License: {item.license}
      </Text>
    </View>
  );

  const ListHeaderComponent = () => (
    <View style={styles.header}>
      <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
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
        contentContainerStyle={{ gap: theme.gap, padding: theme.spacing }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  header: {
    marginBottom: 8,
  },
  licenseName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  licenseType: {
    fontSize: 14,
    marginTop: 4,
  },
});
