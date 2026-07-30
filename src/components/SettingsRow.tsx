import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { SettingsIcon, TSettingsIconName } from "@/components/SettingsIcon";
import { useTheme } from "@/utils/theme";

type TSettingsRowProps = {
  icon: TSettingsIconName;
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
      style={[
        styles.container,
        {
          gap: theme.space.sm,
          paddingHorizontal: theme.space.md,
          paddingVertical: theme.space.sm,
        },
      ]}
      testID={testID}
    >
      <SettingsIcon
        name={icon}
        size={theme.icons.md}
        color={theme.colors.primary}
      />
      <View style={[styles.labels, { gap: theme.space.xs }]}>
        <Text style={{ ...theme.fonts.title, color: theme.colors.text }}>
          {title}
        </Text>
        <Text
          style={{ ...theme.fonts.caption, color: theme.colors.textSecondary }}
        >
          {subtitle}
        </Text>
      </View>
      <SettingsIcon
        name="chevron-forward-outline"
        size={theme.icons.sm}
        color={theme.colors.textSecondary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
  },
  labels: {
    flex: 1,
  },
});
