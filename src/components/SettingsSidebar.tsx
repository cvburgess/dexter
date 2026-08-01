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
          // Web gets a second `md` because `insets.top` is always 0 there —
          // there is no status bar to clear, and the viewport never opts into
          // `viewport-fit=cover` (see WebNav), so nothing else pushes the
          // heading off the top edge the way the inset does on native.
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
            // The rows below carry their own `md` inset so a selected row's
            // fill can extend past its content to the pane's gutter. The
            // heading has no fill and so no inset of its own, which left it
            // hanging a step left of every icon under it — matching the rows'
            // padding is what puts them on one edge. Keep the two in step.
            paddingHorizontal: theme.space.md,
            // Enough to read as a heading over the list rather than a label on
            // the first row of it, which is what the `xs` here used to do. Not
            // the `lg` group separator: the rows are already tall and spaced,
            // so a full group step floated the heading off on its own.
            marginBottom: theme.space.md,
          }}
        >
          Settings
        </Text>

        {SETTINGS_ITEMS.map((item) => {
          const selected = pathname === `/settings/${item.slug}`;
          // One const, read by both the icon and the label below, so the two
          // can't disagree about a selected row's ink.
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
                  // A selected row sinks into the sidebar rather than being a
                  // solid primary slab on it, with `primary` moving to the ink
                  // (DEX-110). `surfaceSunken` is the token because a settings
                  // row *holds* content — see docs/design.md's surface rule —
                  // and the sidebar around it is `background`, so this is the
                  // one step down that rule allows. There is no third surface
                  // to reach for; the issue's `base-300` is deliberately not
                  // ported.
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
