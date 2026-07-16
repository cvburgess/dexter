import { Temporal } from "@js-temporal/polyfill";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { TGoal } from "@/api/goals";
import { dedupeFilters } from "@/api/applyFilters";
import { TList } from "@/api/lists";
import { duplicateTaskInput, ETaskPriority, TTask } from "@/api/tasks";
import { EmptyScreen } from "@/components/EmptyScreen";
import { GlassIconButton } from "@/components/GlassIconButton";
import { IconMenu, TIconMenuOption } from "@/components/IconMenu";
import { PRIORITY_OPTIONS } from "@/components/PriorityControl";
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

// Each id here doubles as a key into `taskFilters` (see `filters` below,
// which ANDs the matching preset onto the base `notScheduledForDateFilters`
// scope) — only add an id whose preset can't contradict that base scope.
// `taskFilters.today`/`taskFiltersForDate`, for instance, would AND a
// `scheduledFor === date` clause onto a base scope that already requires
// `scheduledFor !== date`, silently producing an always-empty query.
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

// Reuses PriorityControl's labels (the priority selector's source of truth)
// rather than re-declaring the wording here; UNPRIORITIZED has no shorthand
// icon/label there, so it's the one entry this map doesn't cover.
const PRIORITY_LABELS: Partial<Record<ETaskPriority, string>> =
  Object.fromEntries(
    PRIORITY_OPTIONS.map(({ value, label }) => [value, label]),
  );

// Grouping order mirrors the legacy dexter-app QuickPlanner's priority
// columns (most to least urgent), plus Unprioritized, which the legacy
// grouping omitted.
const PRIORITY_ORDER: ETaskPriority[] = [
  ETaskPriority.IMPORTANT_AND_URGENT,
  ETaskPriority.URGENT,
  ETaskPriority.IMPORTANT,
  ETaskPriority.NEITHER,
  ETaskPriority.UNPRIORITIZED,
];

/** Builds a titled, selectable option list for an `IconMenu` from a `{id, title}` meta array — shared by the Filter and Group menus. */
function buildMenuOptions<T extends string>(
  meta: { id: T; title: string }[],
  selected: T,
  onSelect: (id: T) => void,
): TIconMenuOption[] {
  return meta.map(({ id, title }) => ({
    id,
    title,
    isSelected: id === selected,
    onSelect: () => onSelect(id),
  }));
}

/** Builds the Filter menu's options. Exported so selection wiring is unit-testable without the native menu host. */
export function filterMenuOptions(
  selected: TFilterId,
  onSelect: (id: TFilterId) => void,
): TIconMenuOption[] {
  return buildMenuOptions(FILTER_META, selected, onSelect);
}

/** Builds the Group menu's options. Exported so selection wiring is unit-testable without the native menu host. */
export function groupMenuOptions(
  selected: TGroupBy,
  onSelect: (id: TGroupBy) => void,
): TIconMenuOption[] {
  return buildMenuOptions(GROUP_META, selected, onSelect);
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
 * A task whose listId/goalId no longer matches any currently-fetched entity
 * (e.g. it was archived) falls into the "No List"/"No Goal" bucket rather
 * than disappearing, matching how `ListButton` falls back to a placeholder
 * for an unresolvable listId.
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
    return PRIORITY_ORDER.map((priority) => ({
      id: String(priority),
      title: PRIORITY_LABELS[priority] ?? "Unprioritized",
      tasks: tasks.filter((task) => task.priority === priority),
    })).filter((group) => group.tasks.length > 0);
  }

  // `groupBy` is narrowed to exactly "listId" | "goalId" here (the "none" and
  // "priority" cases returned above), so it doubles as the task field to
  // group on — no need to re-derive it from another ternary.
  const entities: { id: string; title: string }[] =
    groupBy === "listId"
      ? lists.map((list) => ({
          id: list.id,
          title: `${list.emoji} ${list.title}`,
        }))
      : goals.map((goal) => ({ id: goal.id, title: goal.title }));
  const noneTitle = groupBy === "listId" ? "No List" : "No Goal";
  const entityIds = new Set(entities.map(({ id }) => id));

  return [
    ...entities.map(({ id, title }) => ({
      id,
      title,
      tasks: tasks.filter((task) => task[groupBy] === id),
    })),
    {
      id: "none",
      title: noneTitle,
      tasks: tasks.filter((task) => {
        const value = task[groupBy];
        return value === null || !entityIds.has(value);
      }),
    },
  ].filter((group) => group.tasks.length > 0);
}

type TTaskDrawerProps = {
  /** The day currently being viewed on the Today tab — the drawer shows tasks not scheduled for it. */
  date: Temporal.PlainDate;
};

/**
 * Shared task-drawer content: Filter/Group/Search controls over every
 * incomplete task not scheduled for `date`, with a tap-to-schedule affordance
 * per row. Its root is a single `ScrollView` — the controls scroll as the
 * first rows, above the list — hosted two ways: an `@expo/ui` bottom sheet on
 * small screens (`TaskDrawerSheet`) and a docked pane on large screens
 * (`today/index.tsx`). The `ScrollView`'s `flex: 1` bounds it to the
 * sheet/pane so a long list scrolls rather than overflowing; note the native
 * `@expo/ui` menu controls need an explicit height to render inside it (see
 * `controlButtonInner`) (DEX-33).
 */
export function TaskDrawer({ date }: TTaskDrawerProps) {
  const theme = useTheme();
  const [filterId, setFilterId] = useState<TFilterId>("none");
  const [groupBy, setGroupBy] = useState<TGroupBy>("none");
  const [search, setSearch] = useState("");

  // Lists/goals are only needed once the matching grouping is selected —
  // skip the query otherwise rather than always subscribing to both tables.
  const [lists] = useLists({ skipQuery: groupBy !== "listId" });
  const [goals] = useGoals({ skipQuery: groupBy !== "goalId" });
  const filters = useMemo(
    // `taskFilters` has no "none" entry, so `taskFilters[filterId]` is
    // already undefined (falling back to `[]`) when nothing extra is
    // selected — no separate "none" branch needed.
    () =>
      dedupeFilters([
        ...notScheduledForDateFilters(date),
        ...(taskFilters[filterId] ?? []),
      ]),
    [date, filterId],
  );
  const [tasks, { isLoading, updateTask, createTask, deleteTask }] = useTasks({
    filters,
  });

  const groups = useMemo(
    () => groupTasks(searchTasksByTitle(tasks, search), groupBy, lists, goals),
    [tasks, search, groupBy, lists, goals],
  );
  const hasTasks = groups.length > 0;

  const controlBorder = { borderColor: withOpacity(theme.colors.text, 0.15) };

  return (
    // A single ScrollView is the root (not a flex-1 View wrapping a nested
    // scroller): `react-native-screens` looks for the ScrollView in the
    // Screen's first-descendants chain to coordinate the form sheet's
    // scroll-to-expand/dismiss (see `task-drawer.tsx`), and a `flex: 1` view
    // doesn't size reliably as sheet content on iOS. The controls scroll as
    // the first rows; `flexGrow: 1` lets the empty/loading states fill and
    // center when the list is short.
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { gap: theme.gap }]}
    >
      <View style={[styles.controls, { gap: theme.gap }]}>
        <IconMenu
          accessibilityLabel="Filter"
          menuTitle="Filter"
          sections={[{ options: filterMenuOptions(filterId, setFilterId) }]}
          style={styles.controlButton}
        >
          <View style={[styles.controlButtonInner, controlBorder]}>
            <Text style={{ color: theme.colors.text }} numberOfLines={1}>
              {titleFor(FILTER_META, filterId)}
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
              {titleFor(GROUP_META, groupBy)}
            </Text>
          </View>
        </IconMenu>
      </View>
      <TextInput
        accessibilityLabel="Search"
        placeholder="Search"
        value={search}
        onChangeText={setSearch}
      />
      {isLoading && !hasTasks ? (
        // The drawer's queries only fire once it's first opened (the shell
        // defers mounting), so the initial fetch is visible — show a spinner
        // rather than a bare gap until the list arrives.
        <View style={styles.state}>
          <ActivityIndicator color={theme.colors.textSecondary} />
        </View>
      ) : !hasTasks ? (
        <EmptyScreen message="Nothing here — you're all caught up." />
      ) : (
        <View style={{ gap: theme.gap }}>
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
    </ScrollView>
  );
}

/** Looks up the display title for the currently selected filter/group id, falling back to the id itself if it's ever missing from its meta array (instead of crashing on a non-null assertion). */
function titleFor<T extends string>(
  meta: { id: T; title: string }[],
  id: T,
): string {
  return meta.find((entry) => entry.id === id)?.title ?? id;
}

const styles = StyleSheet.create({
  // `flex: 1` bounds the scroller to its parent's height so a long list
  // scrolls instead of laying out at full content height and overflowing the
  // sheet/pane (react-native-screens honors this for the sheet's descendant
  // ScrollView).
  scroll: {
    flex: 1,
  },
  // `flexGrow: 1` so the empty/loading state can fill and center when the
  // list is short; when it's long the content just overflows and scrolls.
  // (gap is applied inline from the theme.)
  content: {
    flexGrow: 1,
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
  // Explicit height (not `flex: 1`) so the native `@expo/ui` menu host has an
  // intrinsic content height to size to — as sheet content it otherwise
  // collapsed to ~2px (the menu measures its RN child, and a flex-only child
  // has no height until a bounded ancestor resolves, which the sheet's
  // ScrollView doesn't provide). `alignSelf: stretch` fills the menu's width.
  controlButtonInner: {
    alignItems: "center",
    alignSelf: "stretch",
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  state: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
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
