import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";
import { Alert, FlatList, Platform, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { duplicateTaskInput } from "@/api/tasks";
import { DayNav } from "@/components/DayNav";
import { SwipeableDay } from "@/components/SwipeableDay";
import { TaskCard } from "@/components/TaskCard";
import {
  taskFiltersForDate,
  usePrefetchAdjacentTasks,
  useTasks,
} from "@/hooks/useTasks";
import { useTheme } from "@/utils/theme";

type TDayState = {
  date: Temporal.PlainDate;
  direction: -1 | 0 | 1;
};

const confirmDeleteTask = (): Promise<boolean> => {
  // RN's Alert is a no-op on web, so use the browser's confirm dialog there.
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm("Delete this task?"));
  }

  return new Promise((resolve) => {
    Alert.alert("Delete Task", "Delete this task?", [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Delete", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
};

export default function TodayScreen() {
  const theme = useTheme();
  const [day, setDay] = useState<TDayState>(() => ({
    date: Temporal.Now.plainDateISO(),
    direction: 0,
  }));
  const [tasks, { isLoading, updateTask, createTask, deleteTask }] = useTasks({
    filters: taskFiltersForDate(day.date),
  });
  usePrefetchAdjacentTasks(day.date);

  const handleDelete = async (id: string) => {
    const confirmed = await confirmDeleteTask();
    if (!confirmed) return;
    deleteTask(id);
  };

  const changeDate = (next: Temporal.PlainDate) =>
    setDay(({ date }) => ({
      date: next,
      direction: Temporal.PlainDate.compare(next, date),
    }));

  const changeDateBy = (days: 1 | -1) =>
    setDay(({ date }) => {
      const next = date.add({ days });
      return { date: next, direction: Temporal.PlainDate.compare(next, date) };
    });

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <DayNav date={day.date} onChangeDate={changeDate} />
      <SwipeableDay
        dateKey={day.date.toString()}
        direction={day.direction}
        onSwipe={changeDateBy}
      >
        <FlatList
          contentContainerStyle={styles.list}
          data={tasks}
          keyExtractor={(task) => task.id}
          ListEmptyComponent={
            isLoading ? null : (
              <Text
                style={[
                  styles.emptyText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                No tasks scheduled for this day.
              </Text>
            )
          }
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              onUpdate={(diff) => updateTask({ id: item.id, ...diff })}
              onDuplicate={() => createTask(duplicateTaskInput(item))}
              onDelete={() => handleDelete(item.id)}
            />
          )}
        />
      </SwipeableDay>
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
