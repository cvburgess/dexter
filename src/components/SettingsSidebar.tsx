import { usePathname, useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SettingsIcon } from "@/components/SettingsIcon";
import { SETTINGS_ITEMS } from "@/utils/settingsItems";
import { useTheme } from "@/utils/theme";

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
  // detail screens skip theirs (see account.tsx). It also has no stack
  // header above it — unlike the detail pane — so it absorbs the top inset
  // too, or the heading would sit under the status bar.
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          // `background`, matching the detail pane it sits beside rather than
          // the app's nav rail further left. The two panes are one settings
          // surface; the rail is the chrome around it, and giving this the
          // rail's `surfaceSunken` grouped it with the wrong neighbour.
          //
          // That makes the hairline below load-bearing — it is now the only
          // thing dividing the master list from the detail, so it can't be
          // dropped without the two running together.
          backgroundColor: theme.colors.background,
          borderRightColor: theme.colors.border,
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={{
          padding: theme.space.md,
          paddingLeft: theme.space.md + insets.left,
          paddingTop: theme.space.md + insets.top,
          paddingBottom: theme.space.md + insets.bottom,
          gap: theme.space.sm,
        }}
      >
        <Text
          style={{
            ...theme.fonts.heading,
            color: theme.colors.text,
            marginBottom: theme.space.xs,
          }}
        >
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
                  borderRadius: theme.radii.md,
                  gap: theme.space.sm,
                  paddingHorizontal: theme.space.md,
                  paddingVertical: theme.space.md,
                },
              ]}
              testID={`settings-sidebar-${item.slug}`}
            >
              <SettingsIcon
                name={item.icon}
                size={theme.icons.md}
                color={contentColor}
              />
              <Text style={{ ...theme.fonts.title, color: contentColor }}>
                {item.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRightWidth: StyleSheet.hairlineWidth,
    width: 280,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
});
