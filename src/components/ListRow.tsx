import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { TList } from "@/api/lists";
import { useTheme, withOpacity } from "@/utils/theme";

type TListRowProps = {
  list: TList;
  openCount: number;
};

/**
 * A compact list row: emoji tile, title, and its open-task count. Tapping the
 * row opens the create/edit modal. Unlike HabitRow there's no inline toggle, so
 * the whole row is a single tap target.
 */
export function ListRow({ list, openCount }: TListRowProps) {
  const theme = useTheme();
  const router = useRouter();

  const subtitle = `${openCount} open`;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`Edit ${list.title}`}
      onPress={() =>
        router.push({
          pathname: "/settings/lists/[id]",
          params: { id: list.id },
        })
      }
      style={[
        styles.row,
        { gap: theme.space.sm, paddingVertical: theme.space.sm },
      ]}
    >
      <View
        style={[
          styles.tile,
          {
            backgroundColor: withOpacity(theme.colors.text, 0.06),
            borderRadius: theme.radii.md,
            height: theme.controls.md,
            width: theme.controls.md,
          },
        ]}
      >
        <Text style={{ fontSize: theme.icons.md }}>{list.emoji}</Text>
      </View>

      <View style={[styles.labels, { gap: theme.space.xs }]}>
        <Text
          numberOfLines={1}
          style={[theme.fonts.title, { color: theme.colors.text }]}
        >
          {list.title}
        </Text>
        <Text
          numberOfLines={1}
          style={[theme.fonts.caption, { color: theme.colors.textSecondary }]}
        >
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  labels: {
    flex: 1,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
  // The emoji is this row's leading icon, so it takes the icon scale rather
  // than a type role — see `docs/design.md`.
  tile: {
    alignItems: "center",
    justifyContent: "center",
  },
});
