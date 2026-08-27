import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Icon } from "@/components/Icon";
import { TList } from "@/api/lists";
import { useTheme } from "@/utils/theme";

type TListRowProps = {
  list: TList;
  openCount: number;
  /** Confirmation and the write live on the screen, which owns the one
   * `ConfirmationModal` the rows share — a modal per row would mount too many. */
  onArchive: () => void;
};

/** A compact list row: emoji tile, title, open-task count, archive button.
 * Shaped like `HabitRow` — two nested Touchables render invalid DOM on web. */
export function ListRow({ list, openCount, onArchive }: TListRowProps) {
  const theme = useTheme();
  const router = useRouter();

  const subtitle = `${openCount} open`;

  return (
    <View style={[styles.row, { gap: theme.space.sm }]}>
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
          styles.main,
          // md, not sm — with the tile's fill gone the glyph needs the wider
          // step to read as separate (matches HabitRow).
          { gap: theme.space.md, paddingVertical: theme.space.sm },
        ]}
      >
        <View
          style={[
            styles.tile,
            {
              // No fill — a tinted square competed as a second shape. Width
              // matches SettingsRow's leading glyph scale (DEX-61).
              height: theme.controls.md,
              width: theme.icons.md,
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
            style={[
              theme.fonts.subtitle,
              { color: theme.colors.textSecondary },
            ]}
          >
            {subtitle}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Archive ${list.title}`}
        hitSlop={theme.space.sm}
        onPress={onArchive}
        style={[
          styles.archive,
          { height: theme.controls.md, width: theme.controls.sm },
        ]}
        testID={`archive-list-${list.id}`}
      >
        {/* error, not habits' pause-toggle textSecondary — archiving takes
            the list off every screen, unlike a reversible pause. */}
        <Icon
          color={theme.colors.error}
          ionicon="archive-outline"
          sf="archivebox"
          size={theme.icons.md}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: {
    flex: 1,
  },
  main: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
  // As tall as the emoji tile beside it, so the button centers on the row
  // rather than on its own label block; narrower, since it holds one glyph.
  archive: {
    alignItems: "center",
    justifyContent: "center",
  },
  // The emoji is this row's leading icon, so it takes the icon scale rather
  // than a type role — see `docs/design.md`.
  tile: {
    alignItems: "center",
    justifyContent: "center",
  },
});
