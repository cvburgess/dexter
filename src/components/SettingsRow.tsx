import { SymbolView, SymbolViewProps } from "expo-symbols";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "@/utils/theme";

type TSettingsRowProps = {
  icon: SymbolViewProps["name"];
  title: string;
  subtitle: string;
  onPress: () => void;
  testID?: string;
};

export function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  testID,
}: TSettingsRowProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={styles.container}
      testID={testID}
    >
      <SymbolView name={icon} size={22} tintColor={theme.colors.primary} />
      <View style={styles.labels}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          {subtitle}
        </Text>
      </View>
      <SymbolView
        name="chevron.right"
        size={14}
        tintColor={theme.colors.textSecondary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  labels: {
    flex: 1,
    gap: 2,
  },
  subtitle: {
    fontSize: 13,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
  },
});
