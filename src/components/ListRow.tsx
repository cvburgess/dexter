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
      style={styles.row}
    >
      <View
        style={[
          styles.tile,
          {
            backgroundColor: withOpacity(theme.colors.text, 0.06),
            borderRadius: theme.borderRadius,
          },
        ]}
      >
        <Text style={styles.emoji}>{list.emoji}</Text>
      </View>

      <View style={styles.labels}>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: theme.colors.text }]}
        >
          {list.title}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.subtitle, { color: theme.colors.textSecondary }]}
        >
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const TILE_SIZE = 40;

const styles = StyleSheet.create({
  emoji: {
    fontSize: 20,
  },
  labels: {
    flex: 1,
    gap: 2,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 8,
  },
  subtitle: {
    fontSize: 13,
  },
  tile: {
    alignItems: "center",
    height: TILE_SIZE,
    justifyContent: "center",
    width: TILE_SIZE,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
  },
});
