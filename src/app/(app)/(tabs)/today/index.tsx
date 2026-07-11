import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { duplicateTaskInput } from "@/api/tasks";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { DayNav } from "@/components/DayNav";
import { HabitTracker } from "@/components/HabitTracker";
import { SwipeableDay } from "@/components/SwipeableDay";
import { TaskCard } from "@/components/TaskCard";
import { useConfirmation } from "@/hooks/useConfirmation";
import { usePreferences } from "@/hooks/usePreferences";
import {
  taskFiltersForDate,
  usePrefetchAdjacentTasks,
  useTasks,
} from "@/hooks/useTasks";
import { usePublishViewedDay } from "@/hooks/useViewedDay";
import { useTheme } from "@/utils/theme";

type TDayState = {
  date: Temporal.PlainDate;
  direction: -1 | 0 | 1;
};

export default function TodayScreen() {
  const theme = useTheme();
  const { confirm, confirmationProps } = useConfirmation();
  const [preferences] = usePreferences();
  const [day, setDay] = useState<TDayState>(() => ({
    date: Temporal.Now.plainDateISO(),
    direction: 0,
  }));
  const [tasks, { isLoading, updateTask, createTask, deleteTask }] = useTasks({
    filters: taskFiltersForDate(day.date),
  });
  usePrefetchAdjacentTasks(day.date);
  // So "New Task" opened from this tab defaults its schedule to the viewed day.
  usePublishViewedDay(day.date);

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: "Delete Task",
      message: "Delete this task?",
      confirmLabel: "Delete",
      destructive: true,
    });
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
        {preferences.enableHabits && <HabitTracker date={day.date} />}
        {/* A plain ScrollView (not FlatList): a day's list is small, so
            virtualization buys nothing — and the cards contain @expo/ui menu
            hosts that size asynchronously, which virtualized off-viewport
            mounting makes worse (expo/expo#42576). The cards themselves pin
            their heights (see TaskCard/StatusButton) so layout stays stable. */}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
          {tasks.length === 0
            ? !isLoading && (
                <Text
                  style={[
                    styles.emptyText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  No tasks scheduled for this day.
                </Text>
              )
            : tasks.map((item) => (
                <TaskCard
                  key={item.id}
                  task={item}
                  onUpdate={(diff) => updateTask({ id: item.id, ...diff })}
                  onDuplicate={() => createTask(duplicateTaskInput(item))}
                  onDelete={() => handleDelete(item.id)}
                />
              ))}
        </ScrollView>
      </SwipeableDay>
      <ConfirmationModal {...confirmationProps} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Bound the scroll view's height to its flex parent so the day's tasks
  // scroll when they overflow, instead of being clipped.
  scroll: {
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
