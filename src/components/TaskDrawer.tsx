import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { Temporal } from "@js-temporal/polyfill";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TGoal } from "@/api/goals";
import { TList } from "@/api/lists";
import { duplicateTaskInput, ETaskPriority, TTask } from "@/api/tasks";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { DraggableTaskCard } from "@/components/DraggableTaskCard";
import { EmptyScreen } from "@/components/EmptyScreen";
import { TaskScheduleButton } from "@/components/TaskScheduleButton";
import { IconMenu, TIconMenuOption } from "@/components/IconMenu";
import { PRIORITY_OPTIONS } from "@/components/PriorityControl";
import { TextInput } from "@/components/TextInput";
import { useGoals } from "@/hooks/useGoals";
import { useLists } from "@/hooks/useLists";
import { useScheduleChange } from "@/hooks/useScheduleChange";
import { useTasks } from "@/hooks/useTasks";
import { useToday } from "@/hooks/useToday";
import { searchTerms } from "@/utils/searchHighlight";
import {
  filterMenuCounts,
  filterTasks,
  selectBacklogTasks,
  TCountedFilterId,
  TFilterId,
} from "@/utils/taskFilters";
import { useTheme } from "@/utils/theme";

export type TGroupBy = "none" | "listId" | "priority" | "goalId";

export type TTaskGroup = { id: string; title: string; tasks: TTask[] };

// The flattened shape FlashList renders: groups collapsed into one list of
// header/task rows; `getItemType` keys headers and tasks into separate pools.
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

// Reuses PriorityControl's labels rather than re-declaring the wording;
// UNPRIORITIZED has no shorthand there, so it's the one entry this map skips.
const PRIORITY_LABELS: Partial<Record<ETaskPriority, string>> =
  Object.fromEntries(
    PRIORITY_OPTIONS.map(({ value, label }) => [value, label]),
  );

// Mirrors legacy dexter-app's QuickPlanner columns (most to least urgent),
// plus Unprioritized, which that grouping omitted.
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

/**
 * Builds the Filter menu's options. Exported so selection wiring is unit-testable without the native menu host.
 * Optional `counts` suffix each preset's title with its size — `Overdue (7)`; zero counts stay bare (DEX-126).
 * "No Filter" is the whole scope, not a preset, so it never carries a figure.
 */
export function filterMenuOptions(
  selected: TFilterId,
  onSelect: (id: TFilterId) => void,
  counts?: Record<TCountedFilterId, number>,
): TIconMenuOption[] {
  return FILTER_META.map(({ id, title }) => {
    const count = id === "none" ? undefined : counts?.[id];
    return {
      id,
      title: count ? `${title} (${count})` : title,
      isSelected: id === selected,
      onSelect: () => onSelect(id),
    };
  });
}

/** Builds the Group menu's options. Exported so selection wiring is unit-testable without the native menu host. */
export function groupMenuOptions(
  selected: TGroupBy,
  onSelect: (id: TGroupBy) => void,
): TIconMenuOption[] {
  return buildMenuOptions(GROUP_META, selected, onSelect);
}

// ANDs whitespace-separated terms and matches subtask titles too, agreeing
// with search_entries — DEX-47's opened-from-Search-tab drawer depends on it.
export function searchTasksByTitle(tasks: TTask[], search: string): TTask[] {
  const terms = searchTerms(search);
  if (terms.length === 0) return tasks;

  return tasks.filter((task) => {
    const haystack = [task.title, ...task.subtasks.map((sub) => sub.title)]
      .join(" ")
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

// Empty groups are dropped; a task whose listId/goalId no longer resolves
// (e.g. archived) falls into "No List"/"No Goal" rather than disappearing.
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

  // `groupBy` is narrowed to "listId" | "goalId" here, so it doubles as the
  // task field to group on.
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

type TDrawerControlProps = {
  /** Names the menu for assistive tech and titles the native menu sheet. */
  label: string;
  /** The current selection's resolved title — what the button reads. */
  title: string;
  options: TIconMenuOption[];
  /** Whether this control has moved off its `"none"` default. */
  active: boolean;
  testID: string;
};

// Filter and Group share this body after drifting apart twice (height
// DEX-106, border radius); active shows in both the label and the outline.
function DrawerControl({
  label,
  title,
  options,
  active,
  testID,
}: TDrawerControlProps) {
  const theme = useTheme();

  // Same expression `Button` uses for "a full-width control stands a step
  // taller"; lands within a point of `TextInput`'s own padding on both tiers.
  const height = theme.controls.md + theme.space.sm;

  return (
    <IconMenu
      accessibilityLabel={label}
      menuTitle={label}
      sections={[{ options }]}
      style={[styles.controlButton, { height }]}
    >
      <View
        style={[
          styles.controlButtonInner,
          {
            borderColor: active ? theme.colors.primary : theme.colors.border,
            // `radii.md` is the app's one radius, shared with TextInput and
            // the pane around them — these buttons were the drawer's only square chrome.
            borderRadius: theme.radii.md,
            // Same height as the menu host so the box fills it, not the
            // label. Explicit, not `flex: 1` — see `controlButton` below.
            height,
            paddingHorizontal: theme.space.sm,
          },
        ]}
        testID={testID}
      >
        <Text
          style={{
            ...theme.fonts.control,
            color: active ? theme.colors.primary : theme.colors.text,
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
    </IconMenu>
  );
}

type TTaskDrawerProps = {
  /** The day a row's "+" schedules its task onto. */
  date: Temporal.PlainDate;
  /** Days the host already shows, left out of the backlog. Default `[date]`;
   * Week passes all seven columns (DEX-96). Memoize at the call site. */
  daysOnScreen?: Temporal.PlainDate[];
  /** Controls the Filter preset (mobile sheet pre-applies DEX-58's attention
   * filter); omitted for the docked pane, which keeps its own state. */
  filterId?: TFilterId;
  onFilterChange?: (id: TFilterId) => void;
  /** Controls the title search, seeded by a Search-tab result for an
   * unscheduled task (DEX-47), same optional-controlled shape as filterId. */
  search?: string;
  onSearchChange?: (value: string) => void;
  /** Renders the search field; the ritual's Backlog step turns it off
   * (DEX-141). Only the field is dropped, not the search state. */
  showSearch?: boolean;
  /** Declares the drawer is under an animated opacity — liquid glass can't
   * sample through it, so this forces the plain circle (DEX-150). */
  solid?: boolean;
};

// FlashList recycles rather than mounting the whole backlog at once, since
// each row's TaskCard carries several expensive @expo/ui menu hosts (DEX-33).
export function TaskDrawer({
  date,
  daysOnScreen,
  filterId: controlledFilterId,
  onFilterChange,
  search: controlledSearch,
  onSearchChange,
  showSearch = true,
  solid,
}: TTaskDrawerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Controlled by the parent when both props are given (mobile sheet), else
  // self-managed (docked pane) — same optional-controlled shape as an input.
  const [internalFilterId, setInternalFilterId] = useState<TFilterId>("none");
  const filterId = controlledFilterId ?? internalFilterId;
  const setFilterId = onFilterChange ?? setInternalFilterId;
  const [groupBy, setGroupBy] = useState<TGroupBy>("none");
  const [internalSearch, setInternalSearch] = useState("");
  const search = controlledSearch ?? internalSearch;
  const setSearch = onSearchChange ?? setInternalSearch;

  // Lists/goals are only needed once the matching grouping is selected —
  // skip the query otherwise rather than always subscribing to both tables.
  const [lists] = useLists({ skipQuery: groupBy !== "listId" });
  const [goals] = useGoals({ skipQuery: groupBy !== "goalId" });
  const [allTasks, { isLoading, updateTask, createTask, deleteTask }] =
    useTasks();
  // Drives the "+" button's alarm prompt; independent of the drag path's own
  // copy in `DragScheduleProvider` — this drawer renders where there's none.
  const { changeSchedule, confirmationProps } = useScheduleChange(updateTask);
  const today = useToday();
  // The `?? [date]` fallback lives inside the memo: as an inline prop default
  // it would allocate a fresh array every render and defeat it.
  const tasks = useMemo(
    () =>
      filterTasks(
        selectBacklogTasks(allTasks, daysOnScreen ?? [date]),
        filterId,
        today,
      ),
    [allTasks, date, daysOnScreen, filterId, today],
  );

  // Counts over the same scope `tasks` filters, so each figure is what
  // selecting that preset would actually show (DEX-126).
  const menuCounts = useMemo(
    () =>
      filterMenuCounts(
        selectBacklogTasks(allTasks, daysOnScreen ?? [date]),
        today,
      ),
    [allTasks, date, daysOnScreen, today],
  );

  const groups = useMemo(
    () => groupTasks(searchTasksByTitle(tasks, search), groupBy, lists, goals),
    [tasks, search, groupBy, lists, goals],
  );
  const hasTasks = groups.length > 0;

  // Flattened for FlashList: a group's title (if any) becomes a header row,
  // followed by its tasks, all in one recyclable list.
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
    ({ item, index }: { item: TDrawerListItem; index: number }) => {
      if (item.type === "header") {
        return (
          <Text
            style={[
              theme.fonts.title,
              styles.groupTitle,
              {
                color: theme.colors.textSecondary,
                // Tops the separator's `sm` up to the group step or headings
                // run into the group above (docs/design.md). Not the first row.
                marginTop: index === 0 ? 0 : theme.space.lg - theme.space.sm,
              },
            ]}
          >
            {item.title}
          </Text>
        );
      }

      const { task } = item;
      return (
        <View style={[styles.row, { gap: theme.space.sm }]}>
          <View style={styles.cardWrapper}>
            <DraggableTaskCard
              // FlashList recycles by reusing keys without remounting; else
              // edit state and drax's cached drag survive the swap (DEX-77).
              key={task.id}
              task={task}
              onUpdate={(diff) => updateTask({ id: task.id, ...diff })}
              onDuplicate={() => createTask(duplicateTaskInput(task))}
              onPromoteSubtask={(promoted) => createTask(promoted)}
              onDelete={() => deleteTask(task.id)}
            />
          </View>
          {/* Names the day and writes via changeSchedule for the alarm
              prompt (DEX-77/96) — both rules live in TaskScheduleButton. */}
          <TaskScheduleButton
            date={date}
            mode="schedule"
            onChangeSchedule={(target, scheduledFor) =>
              void changeSchedule(target, scheduledFor)
            }
            solid={solid}
            task={task}
          />
        </View>
      );
    },
    [theme, date, changeSchedule, updateTask, createTask, deleteTask, solid],
  );

  const keyExtractor = useCallback((item: TDrawerListItem) => item.id, []);
  const getItemType = useCallback((item: TDrawerListItem) => item.type, []);
  const ItemSeparator = useCallback(
    () => <View style={{ height: theme.space.sm }} />,
    [theme.space.sm],
  );

  // Re-deriving means the old scroll offset is meaningless. Keyed on the
  // inputs, not `listItems` — that identity also changes on an edit.
  const listRef = useRef<FlashListRef<TDrawerListItem>>(null);
  useEffect(() => {
    listRef.current?.scrollToTop({ animated: false });
  }, [filterId, groupBy, search]);

  // The pane extends behind the tab bar, so the inset goes on the content.
  // Memoized — FlashList is React.memo'd; a fresh object re-renders it all.
  const listContentStyle = useMemo(
    () => ({ paddingBottom: insets.bottom }),
    [insets.bottom],
  );

  // The gap between the control cluster and the list, owned by whichever
  // control ends the cluster (see its two use sites below).
  const clusterTailStyle = useMemo(
    () => ({ marginBottom: theme.space.lg - theme.space.sm }),
    [theme.space.lg, theme.space.sm],
  );

  return (
    <View
      style={[
        styles.container,
        { gap: theme.space.sm, padding: theme.space.md },
      ]}
    >
      <View
        style={[
          styles.controls,
          { gap: theme.space.sm },
          // The cluster's tail moves to whichever control is last; dropped
          // entirely, the first card read as one more control in the cluster.
          showSearch ? null : clusterTailStyle,
        ]}
        testID="drawer-controls"
      >
        <DrawerControl
          label="Filter"
          title={titleFor(FILTER_META, filterId)}
          options={filterMenuOptions(filterId, setFilterId, menuCounts)}
          active={filterId !== "none"}
          testID="drawer-filter-surface"
        />
        <DrawerControl
          label="Group"
          title={titleFor(GROUP_META, groupBy)}
          options={groupMenuOptions(groupBy, setGroupBy)}
          active={groupBy !== "none"}
          testID="drawer-group-surface"
        />
      </View>
      {showSearch ? (
        <TextInput
          accessibilityLabel="Search"
          placeholder="Search"
          value={search}
          onChangeText={setSearch}
          // Tops the cluster up to the group step, same as a group heading
          // (docs/design.md); supplied here since TextInput owns no spacing.
          style={clusterTailStyle}
        />
      ) : null}
      {isLoading && !hasTasks ? (
        // Reflects the canonical useTasks() query, usually already resolved
        // by mount — but shown as a spinner rather than a gap when it isn't.
        <View style={styles.state}>
          <ActivityIndicator color={theme.colors.textSecondary} />
        </View>
      ) : !hasTasks ? (
        <EmptyScreen message="Nothing here — you're all caught up." />
      ) : (
        <FlashList
          ref={listRef}
          data={listItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          ItemSeparatorComponent={ItemSeparator}
          style={styles.list}
          contentContainerStyle={listContentStyle}
        />
      )}
      {/* Drives the "+" button's alarm prompt, unlike the drag path's modal
          which sits as a DraxProvider sibling instead. */}
      <ConfirmationModal {...confirmationProps} />
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
  // Bounds this to the sheet/pane's height; padding + inline gap reproduce
  // the old ScrollView's contentContainerStyle spacing.
  container: {
    flex: 1,
  },
  controls: {
    flexDirection: "row",
  },
  // Width only — both buttons also need the inline height (DEX-106): the
  // menu host sizes async and a flex-only trigger collapses to ~2pt.
  controlButton: {
    flex: 1,
  },
  // Radius/border/padding are themed inline; alignSelf fills the menu's width.
  controlButtonInner: {
    alignItems: "center",
    alignSelf: "stretch",
    borderWidth: 1,
    justifyContent: "center",
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
