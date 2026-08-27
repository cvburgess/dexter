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
          // `md` throughout — a destination row, not a dense data list, gets
          // the same inset SettingsSidebar gives its rows on wide screens.
          gap: theme.space.md,
          paddingHorizontal: theme.space.md,
          paddingVertical: theme.space.md,
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
      {/* icons.md matches the leading glyph rather than icons.sm — at sm the
          chevron disappeared against the subtitle. */}
      <SettingsIcon
        name="chevron-forward-outline"
        size={theme.icons.md}
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
