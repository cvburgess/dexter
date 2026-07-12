import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { THabit, TUpdateHabit } from "@/api/habits";
import { useTheme, withOpacity } from "@/utils/theme";

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
    // A plain View, not a Touchable: the row hosts two separate tap targets
    // (edit + pause). Nesting one Touchable inside another renders as a
    // <button> inside a <button> on web, which is invalid DOM.
    <View style={[styles.row, { opacity: habit.isPaused ? 0.5 : 1 }]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Edit ${habit.title}`}
        onPress={() =>
          router.push({
            pathname: "/settings/habits/[id]",
            params: { id: habit.id },
          })
        }
        style={styles.main}
      >
        <View
          style={[
            styles.tile,
            { backgroundColor: withOpacity(theme.colors.text, 0.06) },
          ]}
        >
          <Text style={styles.emoji}>{habit.emoji}</Text>
        </View>

        <View style={styles.labels}>
          <Text
            numberOfLines={1}
            style={[styles.title, { color: theme.colors.text }]}
          >
            {habit.title}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.subtitle, { color: theme.colors.textSecondary }]}
          >
            {subtitle}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={habit.isPaused ? "Resume habit" : "Pause habit"}
        hitSlop={8}
        onPress={() => updateHabit({ id: habit.id, isPaused: !habit.isPaused })}
        style={styles.pause}
      >
        <Ionicons
          color={theme.colors.textSecondary}
          name={habit.isPaused ? "play" : "pause"}
          size={20}
        />
      </TouchableOpacity>
    </View>
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
  main: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  pause: {
    alignItems: "center",
    height: TILE_SIZE,
    justifyContent: "center",
    width: 32,
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
    borderRadius: 8,
    height: TILE_SIZE,
    justifyContent: "center",
    width: TILE_SIZE,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
  },
});
