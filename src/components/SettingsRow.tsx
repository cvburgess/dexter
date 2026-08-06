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
          // `md` throughout, never the in-group `sm`. For `gap`: the leading
          // icon and the title/subtitle pair are two different things sharing a
          // row, not two controls in a cluster, and at `sm` the glyph crowded
          // the title. For the padding: a menu item is a destination you press,
          // not a dense list of data, so it gets the same inset on all four
          // sides — which is also what `SettingsSidebar` already gives its rows,
          // so the phone and two-pane paths stay the same shape. This row is
          // small-screen only — wide screens redirect the list to a detail and
          // `SettingsSidebar` takes over (see settings/index.tsx).
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
      {/*
        `icons.md`, matching the leading glyph rather than taking `icons.sm`
        like an inline affordance would. This chevron terminates the row it
        belongs to, so it reads as that glyph's counterweight across the row;
        at `sm` it was small enough to disappear against the subtitle.
      */}
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
