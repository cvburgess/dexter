import { FlatList, StyleSheet, Text, View } from "react-native";

import packageJson from "@/package.json";
import licensesJson from "@/utils/licenses.json";
import { useTheme, withOpacity } from "@/utils/theme";

const licenses = licensesJson as Record<string, string>;

type TLicenseItem = {
  name: string;
  license: string;
};

export default function LicensesScreen() {
  const theme = useTheme();

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
    <View style={styles.row}>
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
    <FlatList
      data={sortedDependencies}
      renderItem={renderItem}
      keyExtractor={(item) => item.name}
      ListHeaderComponent={ListHeaderComponent}
      ItemSeparatorComponent={() => (
        <View
          style={[
            styles.divider,
            { backgroundColor: withOpacity(theme.colors.text, 0.1) },
          ]}
        />
      )}
      contentContainerStyle={{ padding: theme.spacing }}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    />
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
  divider: {
    height: StyleSheet.hairlineWidth,
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
  row: {
    paddingVertical: 12,
  },
});
