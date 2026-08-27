import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { THabit, TUpdateHabit } from "@/api/habits";
import { useTheme } from "@/utils/theme";

type THabitRowProps = {
  habit: THabit;
  updateHabit: (habit: TUpdateHabit) => void;
};

/**
 * A compact habit row: emoji tile, title, its schedule, and an inline
 * pause/resume toggle. Tapping the row opens the create/edit modal; the pause
 * button toggles in place without leaving the list.
 */
export function HabitRow({ habit, updateHabit }: THabitRowProps) {
  const theme = useTheme();
  const router = useRouter();

  const subtitle = `${habit.steps}× daily · ${habit.daysActive.length}× weekly`;

  return (
    // Plain View, not a Touchable — two nested Touchables render as a
    // <button> inside a <button> on web, which is invalid DOM.
    <View
      style={[
        styles.row,
        {
          gap: theme.space.sm,
          opacity: habit.isPaused ? 0.5 : 1,
          paddingVertical: theme.space.sm,
        },
      ]}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Edit ${habit.title}`}
        onPress={() =>
          router.push({
            pathname: "/settings/habits/[id]",
            params: { id: habit.id },
          })
        }
        // md, not the row's sm — the glyph needs the wider step to read as
        // separate (matches ListRow).
        style={[styles.main, { gap: theme.space.md }]}
      >
        <View
          style={[
            styles.tile,
            {
              // No fill — a tinted square read as a competing shape.
              // Width is the icon scale, matching SettingsRow (see ListRow, DEX-61).
              height: theme.controls.md,
              width: theme.icons.md,
            },
          ]}
        >
          <Text style={{ fontSize: theme.icons.md }}>{habit.emoji}</Text>
        </View>

        <View style={[styles.labels, { gap: theme.space.xs }]}>
          <Text
            numberOfLines={1}
            style={[theme.fonts.title, { color: theme.colors.text }]}
          >
            {habit.title}
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
        accessibilityLabel={habit.isPaused ? "Resume habit" : "Pause habit"}
        hitSlop={theme.space.sm}
        onPress={() => updateHabit({ id: habit.id, isPaused: !habit.isPaused })}
        style={[
          styles.pause,
          { height: theme.controls.md, width: theme.controls.sm },
        ]}
      >
        <Ionicons
          color={theme.colors.textSecondary}
          name={habit.isPaused ? "play" : "pause"}
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
  // As tall as the emoji tile beside it, so the toggle centers on the row
  // rather than on its own label block; narrower, since it holds one glyph.
  pause: {
    alignItems: "center",
    justifyContent: "center",
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
