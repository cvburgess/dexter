import { usePathname, useRouter } from "expo-router";
import {
  Platform,
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

// Persistent master list beside the detail pane on large screens; highlights
// whichever subview is currently routed.
export function SettingsSidebar() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  // Owns the physical left edge in two-pane mode, so it absorbs the left
  // inset (detail screens skip theirs); no stack header, so it absorbs top too.
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        // `background`, matching the detail pane, not the rail beside it —
        // the hairline below is now the only divider, so it's load-bearing.
        {
          backgroundColor: theme.colors.background,
          borderRightColor: theme.colors.border,
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={{
          padding: theme.space.md,
          paddingLeft: theme.space.md + insets.left,
          // Web's insets.top is always 0 — no status bar, no cover viewport —
          // so nothing else pushes the heading off the top edge like on native.
          paddingTop:
            theme.space.md +
            insets.top +
            (Platform.OS === "web" ? theme.space.md : 0),
          paddingBottom: theme.space.md + insets.bottom,
          gap: theme.space.sm,
        }}
      >
        <Text
          style={{
            ...theme.fonts.heading,
            color: theme.colors.text,
            // Matches the rows' own inset so heading and icons share one edge.
            paddingHorizontal: theme.space.md,
            // Not the `lg` group separator — the rows are already tall/spaced,
            // so a full group step floated the heading off on its own.
            marginBottom: theme.space.md,
          }}
        >
          Settings
        </Text>

        {SETTINGS_ITEMS.map((item) => {
          const selected = pathname === `/settings/${item.slug}`;
          // One const so the icon and label can't disagree about a row's ink.
          const contentColor = selected
            ? theme.colors.primary
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
                  // Sinks into the sidebar rather than a solid primary slab,
                  // with primary moving to the ink instead (DEX-110).
                  backgroundColor: selected
                    ? theme.colors.surfaceSunken
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
