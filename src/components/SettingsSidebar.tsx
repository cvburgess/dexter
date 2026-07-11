import { usePathname, useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SettingsIcon } from "@/components/SettingsIcon";
import { SETTINGS_ITEMS } from "@/utils/settingsItems";
import { useTheme, withOpacity } from "@/utils/theme";

/**
 * The persistent master list shown alongside the detail pane on large screens
 * (see settings/_layout.tsx). Mirrors the settings list, highlighting whichever
 * subview is currently routed and swapping the detail in place on tap.
 */
export function SettingsSidebar() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  // The sidebar owns the physical left edge in two-pane mode, so it absorbs
  // the left safe-area inset (e.g. the notch on a landscape phone); the
  // detail screens skip theirs (see account.tsx).
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          borderRightColor: withOpacity(theme.colors.text, 0.1),
          padding: theme.spacing,
          paddingLeft: theme.spacing + insets.left,
          gap: theme.gap,
        },
      ]}
    >
      <Text style={[styles.heading, { color: theme.colors.text }]}>
        Settings
      </Text>

      {SETTINGS_ITEMS.map((item) => {
        const selected = pathname === `/settings/${item.slug}`;
        const contentColor = selected
          ? theme.colors.primaryContent
          : theme.colors.text;

        return (
          <TouchableOpacity
            key={item.slug}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => router.replace(`/settings/${item.slug}`)}
            style={[
              styles.row,
              {
                backgroundColor: selected
                  ? theme.colors.primary
                  : "transparent",
                borderRadius: theme.borderRadius,
              },
            ]}
            testID={`settings-sidebar-${item.slug}`}
          >
            <SettingsIcon name={item.icon} size={20} color={contentColor} />
            <Text style={[styles.label, { color: contentColor }]}>
              {item.title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRightWidth: StyleSheet.hairlineWidth,
    width: 280,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
