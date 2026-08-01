import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Icon } from "@/components/Icon";
import { TList } from "@/api/lists";
import { useTheme } from "@/utils/theme";

type TListRowProps = {
  list: TList;
  openCount: number;
  /**
   * Archives the list. Confirmation and the write itself live on the screen,
   * which owns the one `ConfirmationModal` the rows share — a modal per row
   * would mount one for every list on screen.
   */
  onArchive: () => void;
};

/**
 * A compact list row: emoji tile, title, its open-task count, and an archive
 * button. Tapping the row itself opens the create/edit modal.
 *
 * Shaped like `HabitRow` and for the same reason: the row hosts two separate
 * tap targets, and nesting one Touchable inside another renders as a `<button>`
 * inside a `<button>` on web, which is invalid DOM.
 */
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
          // `md` between the emoji and its labels, matching `HabitRow`: with
          // the tile's fill gone the glyph has no edge of its own, so it needs
          // the wider step to read as separate from the title beside it.
          { gap: theme.space.md, paddingVertical: theme.space.sm },
        ]}
      >
        <View
          style={[
            styles.tile,
            {
              // No fill behind the emoji: the glyph is the icon, and a tinted
              // square under it read as a second, competing shape in the row.
              //
              // Height is a control size so the row keeps its height and the
              // archive button beside it stays centered on the row rather than
              // on the label block. Width is the *icon* scale, matching
              // `SettingsRow`'s leading glyph: at `controls.md` the emoji wore
              // 10pt of dead space on each side, which read as an indent from
              // the card's edge and pushed the title 20pt further right than
              // the settings rows' (DEX-61). An emoji's advance runs a little
              // wider than its font size, so the glyph overflows this box by a
              // point or two — nothing clips it, and a fixed box is what keeps
              // every title in the list aligned.
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
        {/* `error`, not the `textSecondary` habits' pause toggle uses: pausing
            a habit is reversible in place, and archiving takes the list off
            every screen it appears on. */}
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
