import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";
import { FlatList, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DayNav } from "@/components/DayNav";
import { TaskCard } from "@/components/TaskCard";
import { taskFiltersForDate, useTasks } from "@/hooks/useTasks";
import { useTheme } from "@/utils/theme";

export default function TodayScreen() {
  const theme = useTheme();
  const [date, setDate] = useState(() => Temporal.Now.plainDateISO());
  const [tasks, { updateTask }] = useTasks({
    filters: taskFiltersForDate(date),
  });

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <DayNav date={date} onChangeDate={setDate} />
      <FlatList
        contentContainerStyle={styles.list}
        data={tasks}
        keyExtractor={(task) => task.id}
        ListEmptyComponent={
          <Text
            style={[styles.emptyText, { color: theme.colors.textSecondary }]}
          >
            No tasks scheduled for this day.
          </Text>
        }
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            onUpdate={(diff) => updateTask({ id: item.id, ...diff })}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    gap: 8,
    padding: 16,
  },
  emptyText: {
    fontSize: 14,
    paddingTop: 32,
    textAlign: "center",
  },
});
