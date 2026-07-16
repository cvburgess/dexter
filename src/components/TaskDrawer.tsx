import { Temporal } from "@js-temporal/polyfill";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { duplicateTaskInput, ETaskPriority, TTask } from "@/api/tasks";
import { TGoal } from "@/api/goals";
import { TList } from "@/api/lists";
import { EmptyScreen } from "@/components/EmptyScreen";
import { GlassIconButton } from "@/components/GlassIconButton";
import { IconMenu, TIconMenuOption } from "@/components/IconMenu";
import { TaskCard } from "@/components/TaskCard";
import { TextInput } from "@/components/TextInput";
import { useGoals } from "@/hooks/useGoals";
import { useLists } from "@/hooks/useLists";
import {
  notScheduledForDateFilters,
  taskFilters,
  useTasks,
} from "@/hooks/useTasks";
import { useTheme, withOpacity } from "@/utils/theme";

export type TFilterId =
  "none" | "overdue" | "dueSoon" | "leftBehind" | "unscheduled";

export type TGroupBy = "none" | "listId" | "priority" | "goalId";

export type TTaskGroup = { id: string; title: string; tasks: TTask[] };

const FILTER_META: { id: TFilterId; title: string }[] = [
  { id: "none", title: "No Filter" },
  { id: "overdue", title: "Overdue" },
  { id: "dueSoon", title: "Due Soon" },
  { id: "leftBehind", title: "Left Behind" },
  { id: "unscheduled", title: "Unscheduled" },
];

const GROUP_META: { id: TGroupBy; title: string }[] = [
  { id: "none", title: "No Grouping" },
  { id: "listId", title: "By List" },
  { id: "priority", title: "By Priority" },
  { id: "goalId", title: "By Goal" },
];

// Grouping order mirrors the legacy dexter-app QuickPlanner's priority
// columns (most to least urgent), plus Unprioritized, which the legacy
// grouping omitted.
const PRIORITY_GROUPS: { priority: ETaskPriority; title: string }[] = [
  {
    priority: ETaskPriority.IMPORTANT_AND_URGENT,
    title: "Important & Urgent",
  },
  { priority: ETaskPriority.URGENT, title: "Urgent" },
  { priority: ETaskPriority.IMPORTANT, title: "Important" },
  { priority: ETaskPriority.NEITHER, title: "Neither" },
  { priority: ETaskPriority.UNPRIORITIZED, title: "Unprioritized" },
];

/** Builds the Filter menu's options. Exported so selection wiring is unit-testable without the native menu host. */
export function filterMenuOptions(
  selected: TFilterId,
  onSelect: (id: TFilterId) => void,
): TIconMenuOption[] {
  return FILTER_META.map(({ id, title }) => ({
    id,
    title,
    isSelected: id === selected,
    onSelect: () => onSelect(id),
  }));
}

/** Builds the Group menu's options. Exported so selection wiring is unit-testable without the native menu host. */
export function groupMenuOptions(
  selected: TGroupBy,
  onSelect: (id: TGroupBy) => void,
): TIconMenuOption[] {
  return GROUP_META.map(({ id, title }) => ({
    id,
    title,
    isSelected: id === selected,
    onSelect: () => onSelect(id),
  }));
}

/** Live, case-insensitive title filter — matches the legacy QuickPlanner's client-side search. */
export function searchTasksByTitle(tasks: TTask[], search: string): TTask[] {
  const query = search.trim().toLowerCase();
  if (!query) return tasks;
  return tasks.filter((task) => task.title.toLowerCase().includes(query));
}

/**
 * Splits `tasks` into the sections the Group menu selects: none (a single
 * unlabeled group), by list, by priority, or by goal. Empty groups are
 * dropped so an unused list/goal/priority doesn't render an empty section.
 */
export function groupTasks(
  tasks: TTask[],
  groupBy: TGroupBy,
  lists: TList[],
  goals: TGoal[],
): TTaskGroup[] {
  if (groupBy === "none") {
    return tasks.length > 0 ? [{ id: "all", title: "", tasks }] : [];
  }

  if (groupBy === "priority") {
    return PRIORITY_GROUPS.map(({ priority, title }) => ({
      id: String(priority),
      title,
      tasks: tasks.filter((task) => task.priority === priority),
    })).filter((group) => group.tasks.length > 0);
  }

  const entities: { id: string; title: string }[] =
    groupBy === "listId"
      ? lists.map((list) => ({
          id: list.id,
          title: `${list.emoji} ${list.title}`,
        }))
      : goals.map((goal) => ({ id: goal.id, title: goal.title }));
  const key = groupBy === "listId" ? "listId" : "goalId";
  const noneTitle = groupBy === "listId" ? "No List" : "No Goal";

  return [
    ...entities.map(({ id, title }) => ({
      id,
      title,
      tasks: tasks.filter((task) => task[key] === id),
    })),
    {
      id: "none",
      title: noneTitle,
      tasks: tasks.filter((task) => task[key] === null),
    },
  ].filter((group) => group.tasks.length > 0);
}

type TTaskDrawerProps = {
  /** The day currently being viewed on the Today tab — the drawer shows tasks not scheduled for it. */
  date: Temporal.PlainDate;
};

/**
 * Shared task-drawer content: Filter/Group/Search controls over every
 * incomplete task not scheduled for `date`, with a tap-to-schedule
 * affordance per row. Hosted by two shells — a bottom sheet on small screens
 * (`TaskDrawerSheet`) and a docked pane on large screens (`today/index.tsx`)
 * — so this component owns no scroll container of its own; the shell
 * supplies one (DEX-33).
 */
export function TaskDrawer({ date }: TTaskDrawerProps) {
  const theme = useTheme();
  const [filterId, setFilterId] = useState<TFilterId>("none");
  const [groupBy, setGroupBy] = useState<TGroupBy>("none");
  const [search, setSearch] = useState("");

  const [lists] = useLists();
  const [goals] = useGoals();
  const [tasks, { isLoading, updateTask, createTask, deleteTask }] = useTasks({
    filters: [
      ...notScheduledForDateFilters(date),
      ...(filterId === "none" ? [] : taskFilters[filterId]),
    ],
  });

  const groups = groupTasks(
    searchTasksByTitle(tasks, search),
    groupBy,
    lists,
    goals,
  );
  const hasTasks = groups.some((group) => group.tasks.length > 0);

  const controlBorder = { borderColor: withOpacity(theme.colors.text, 0.15) };

  return (
    <View style={styles.container}>
      <View style={[styles.controls, { gap: theme.gap }]}>
        <IconMenu
          accessibilityLabel="Filter"
          menuTitle="Filter"
          sections={[{ options: filterMenuOptions(filterId, setFilterId) }]}
          style={styles.controlButton}
        >
          <View style={[styles.controlButtonInner, controlBorder]}>
            <Text style={{ color: theme.colors.text }} numberOfLines={1}>
              {FILTER_META.find(({ id }) => id === filterId)!.title}
            </Text>
          </View>
        </IconMenu>
        <IconMenu
          accessibilityLabel="Group"
          menuTitle="Group"
          sections={[{ options: groupMenuOptions(groupBy, setGroupBy) }]}
          style={styles.controlButton}
        >
          <View style={[styles.controlButtonInner, controlBorder]}>
            <Text style={{ color: theme.colors.text }} numberOfLines={1}>
              {GROUP_META.find(({ id }) => id === groupBy)!.title}
            </Text>
          </View>
        </IconMenu>
      </View>
      <TextInput
        accessibilityLabel="Search"
        placeholder="Search"
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />
      {!hasTasks && !isLoading ? (
        <EmptyScreen message="Nothing here — you're all caught up." />
      ) : (
        <View style={[styles.list, { gap: theme.gap }]}>
          {groups.map((group) => (
            <View key={group.id} style={{ gap: theme.gap }}>
              {group.title ? (
                <Text
                  style={[
                    styles.groupTitle,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  {group.title}
                </Text>
              ) : null}
              {group.tasks.map((task) => (
                <View key={task.id} style={[styles.row, { gap: theme.gap }]}>
                  <View style={styles.cardWrapper}>
                    <TaskCard
                      task={task}
                      onUpdate={(diff) => updateTask({ id: task.id, ...diff })}
                      onDuplicate={() => createTask(duplicateTaskInput(task))}
                      onDelete={() => deleteTask(task.id)}
                    />
                  </View>
                  <GlassIconButton
                    accessibilityLabel={`Schedule "${task.title}" for this day`}
                    sfSymbol="plus"
                    ionicon="add-outline"
                    onPress={() =>
                      updateTask({ id: task.id, scheduledFor: date.toString() })
                    }
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  controls: {
    flexDirection: "row",
  },
  // Pinned size: the native `@expo/ui` menu host sizes asynchronously, and a
  // content-sized trigger can render untappable on device (same reason
  // StatusButton/ListButton/DayViewSwitcher pin theirs).
  controlButton: {
    flex: 1,
    height: 40,
  },
  controlButtonInner: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  search: {
    marginTop: 12,
  },
  list: {
    marginTop: 16,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
  cardWrapper: {
    flex: 1,
  },
});
