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
          // `md`, not the in-group `sm`: the leading icon and the title/subtitle
          // pair are two different things sharing a row, not two controls in a
          // cluster, and at `sm` the glyph crowded the title. This row is
          // small-screen only — wide screens redirect the list to a detail and
          // `SettingsSidebar` takes over (see settings/index.tsx).
          gap: theme.space.md,
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
          style={{ ...theme.fonts.subtitle, color: theme.colors.textSecondary }}
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
