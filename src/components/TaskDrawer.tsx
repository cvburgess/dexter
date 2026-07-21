import { FlashList } from "@shopify/flash-list";
import { Temporal } from "@js-temporal/polyfill";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { TGoal } from "@/api/goals";
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
import { useTasks } from "@/hooks/useTasks";
import {
  filterTasks,
  selectBacklogTasks,
  TFilterId,
} from "@/utils/taskFilters";
import { useTheme, withOpacity } from "@/utils/theme";

export type TGroupBy = "none" | "listId" | "priority" | "goalId";

export type TTaskGroup = { id: string; title: string; tasks: TTask[] };

// The flattened shape `FlashList` renders: `groupTasks`'s `{id, title, tasks}[]`
// groups collapsed into a single list of header/task rows so recycling can
// work across group boundaries. `getItemType` keys off `type` so headers and
// task rows recycle into separate cell pools.
type TDrawerListItem =
  | { type: "header"; id: string; title: string }
  | { type: "task"; id: string; task: TTask };

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
  /**
   * Controls the Filter preset from the parent when provided (with
   * `onFilterChange`) — used by the mobile sheet to pre-apply the attention
   * filter on open (DEX-58). Omitted for the docked large-screen pane, which
   * keeps its own internal filter state.
   */
  filterId?: TFilterId;
  onFilterChange?: (id: TFilterId) => void;
};

/**
 * Shared task-drawer content: Filter/Group/Search controls over every
 * incomplete task not scheduled for `date`, with a tap-to-schedule affordance
 * per row. Hosted two ways: an `@expo/ui` bottom sheet on small screens
 * (`TaskDrawerSheet`) and a docked pane on large screens (`today/index.tsx`).
 * The controls+search sit above a `FlashList` of the (possibly large, in
 * contrast to a single day's list) backlog — recycled rather than all mounted
 * at once, since each row's `TaskCard` carries multiple `@expo/ui` native
 * menu hosts (see `TaskCard.tsx`'s `minHeight` comment) that are expensive to
 * mount in bulk. Root is a plain `flex: 1` `View`, not a `ScrollView`: only
 * `FlashList` needs to scroll (it owns its own internal scroll), and nesting
 * a scroller inside a `ScrollView` breaks virtualization. `@shopify/flash-list`
 * still renders a real RN `ScrollView` under the hood (see its own
 * `CompatScroller.ts`), which is what lets the small-screen `@expo/ui`
 * `BottomSheetModal` (`TaskDrawerSheet`) keep coordinating its native
 * drag-to-dismiss/scroll-to-expand gestures with this list — verified
 * hands-on on iOS after the FlashList migration. Note the native `@expo/ui`
 * menu controls need an explicit height to render (see `controlButtonInner`)
 * (DEX-33).
 */
export function TaskDrawer({
  date,
  filterId: controlledFilterId,
  onFilterChange,
}: TTaskDrawerProps) {
  const theme = useTheme();
  // Controlled by the parent when both props are given (mobile sheet), else
  // self-managed (docked large-screen pane) — same optional-controlled shape
  // as a standard input.
  const [internalFilterId, setInternalFilterId] = useState<TFilterId>("none");
  const filterId = controlledFilterId ?? internalFilterId;
  const setFilterId = onFilterChange ?? setInternalFilterId;
  const [groupBy, setGroupBy] = useState<TGroupBy>("none");
  const [search, setSearch] = useState("");

  // Lists/goals are only needed once the matching grouping is selected —
  // skip the query otherwise rather than always subscribing to both tables.
  const [lists] = useLists({ skipQuery: groupBy !== "listId" });
  const [goals] = useGoals({ skipQuery: groupBy !== "goalId" });
  const [allTasks, { isLoading, updateTask, createTask, deleteTask }] =
    useTasks();
  const tasks = useMemo(
    () =>
      filterTasks(
        selectBacklogTasks(allTasks, date),
        filterId,
        Temporal.Now.plainDateISO(),
      ),
    [allTasks, date, filterId],
  );

  const groups = useMemo(
    () => groupTasks(searchTasksByTitle(tasks, search), groupBy, lists, goals),
    [tasks, search, groupBy, lists, goals],
  );
  const hasTasks = groups.length > 0;

  // Flattened for FlashList: a group's title (when it has one — "no
  // grouping" collapses everything into one untitled group) becomes a header
  // row, followed by its tasks as task rows, all in one recyclable list.
  const listItems = useMemo<TDrawerListItem[]>(
    () =>
      groups.flatMap((group) => [
        ...(group.title
          ? [
              {
                type: "header" as const,
                id: `header-${group.id}`,
                title: group.title,
              },
            ]
          : []),
        ...group.tasks.map((task) => ({
          type: "task" as const,
          id: task.id,
          task,
        })),
      ]),
    [groups],
  );

  const renderItem = useCallback(
    ({ item }: { item: TDrawerListItem }) => {
      if (item.type === "header") {
        return (
          <Text
            style={[styles.groupTitle, { color: theme.colors.textSecondary }]}
          >
            {item.title}
          </Text>
        );
      }

      const { task } = item;
      return (
        <View style={[styles.row, { gap: theme.gap }]}>
          <View style={styles.cardWrapper}>
            <TaskCard
              task={task}
              onUpdate={(diff) => updateTask({ id: task.id, ...diff })}
              onDuplicate={() => createTask(duplicateTaskInput(task))}
              onPromoteSubtask={(promoted) => createTask(promoted)}
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
      );
    },
    [theme, date, updateTask, createTask, deleteTask],
  );

  const keyExtractor = useCallback((item: TDrawerListItem) => item.id, []);
  const getItemType = useCallback((item: TDrawerListItem) => item.type, []);
  const ItemSeparator = useCallback(
    () => <View style={{ height: theme.gap }} />,
    [theme.gap],
  );

  const controlBorder = { borderColor: withOpacity(theme.colors.text, 0.15) };

  return (
    <View style={[styles.container, { gap: theme.gap }]}>
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
        // `isLoading` reflects the canonical `useTasks()` query shared with
        // the Tasks pane — usually already resolved by the time this drawer
        // first mounts (the shell defers mounting until opened), but shown as
        // a spinner rather than a bare gap on a cold app start where it isn't.
        <View style={styles.state}>
          <ActivityIndicator color={theme.colors.textSecondary} />
        </View>
      ) : !hasTasks ? (
        <EmptyScreen message="Nothing here — you're all caught up." />
      ) : (
        <FlashList
          data={listItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          ItemSeparatorComponent={ItemSeparator}
          style={styles.list}
        />
      )}
    </View>
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
  // `flex: 1` bounds this to the sheet/pane's height; whichever child ends up
  // scrollable (the FlashList branch — the loading/empty branches are small,
  // static content with no need to scroll) fills the remaining space below
  // the controls/search. `padding` + inline `gap` reproduce what used to be
  // the ScrollView's `contentContainerStyle` spacing.
  container: {
    flex: 1,
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
  // content doesn't provide). `alignSelf: stretch` fills the menu's width.
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
  // Fills the remaining space below the controls/search; FlashList owns its
  // own internal scrolling and recycling.
  list: {
    flex: 1,
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
