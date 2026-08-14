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
  filterTasks,
  selectBacklogTasks,
  TFilterId,
} from "@/utils/taskFilters";
import { useTheme } from "@/utils/theme";

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

/**
 * Live, case-insensitive task filter — the legacy QuickPlanner's client-side
 * search.
 *
 * Splits and ANDs whitespace-separated terms via the shared `searchTerms`, and
 * matches subtask titles as well as the task's own, so it agrees with what the
 * `search_entries` RPC would have matched. That agreement is load-bearing since
 * DEX-47: a Search-tab result for an unscheduled task opens this drawer seeded
 * with the query the RPC answered, so a whole-query `includes` would filter out
 * the very task the user tapped whenever its terms appear out of order
 * ("buy milk" vs a task titled "Milk — remember to buy") or matched a subtask.
 */
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

type TDrawerControlProps = {
  /** Names the menu for assistive tech and titles the native menu sheet. */
  label: string;
  /** The current selection's resolved title — what the button reads. */
  title: string;
  options: TIconMenuOption[];
  /**
   * Whether this control has moved off its default (the `"none"` entry each
   * meta list leads with: "No Filter" / "No Grouping").
   */
  active: boolean;
  testID: string;
};

/**
 * One of the drawer's two menu buttons. Filter and Group are the same control
 * with different contents, and they had drifted apart twice — once on height
 * (DEX-106), once on their border radius — so they share a body rather than
 * two call sites that have to be kept in step.
 *
 * **Active means "off its default", and it shows in both the label and the
 * outline.** The label already names the selection, but "Overdue" and "No
 * Grouping" read identically when both are plain ink inside a plain hairline,
 * so an applied filter was invisible until you opened the menu.
 */
function DrawerControl({
  label,
  title,
  options,
  active,
  testID,
}: TDrawerControlProps) {
  const theme = useTheme();

  // Filter, Group, and the search field under them are one cluster and should
  // read as one size. `controls.md + space.sm` is the same expression `Button`
  // uses for "a full-width control stands a step taller than a round icon
  // button", and it lands within a point of what `TextInput`'s own padding
  // resolves to on both density tiers — so the three line up without this
  // reaching into the shared input.
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
            // `radii.md` is the app's one corner radius, shared with the
            // `TextInput` below these two and with the pane around them
            // (DEX-106); these buttons were the drawer's only square chrome.
            borderRadius: theme.radii.md,
            // The same height as the menu host, so the bordered box fills it
            // instead of hugging its label — without this the pill shrank to
            // the text and read as squashed against the search field. Explicit,
            // not `flex: 1`: see `controlButton` in the stylesheet.
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
  /**
   * The days the host already has on screen, which the drawer therefore leaves
   * out of the backlog. Defaults to `[date]` — the Today tab's single day. The
   * Week tab passes all seven of its columns (DEX-96), since offering back six
   * days the user is already looking at isn't a backlog.
   *
   * Memoize it at the call site: it feeds the `tasks` memo below.
   */
  daysOnScreen?: Temporal.PlainDate[];
  /**
   * Controls the Filter preset from the parent when provided (with
   * `onFilterChange`) — used by the mobile sheet to pre-apply the attention
   * filter on open (DEX-58). Omitted for the docked large-screen pane, which
   * keeps its own internal filter state.
   */
  filterId?: TFilterId;
  onFilterChange?: (id: TFilterId) => void;
  /**
   * Controls the title search from the parent when provided (with
   * `onSearchChange`), the same optional-controlled shape as `filterId` above.
   * Both hosts use it to seed the box when a Search-tab result for an
   * unscheduled task opens the backlog (DEX-47), so the task the user tapped is
   * on screen immediately rather than somewhere in the backlog.
   */
  search?: string;
  onSearchChange?: (value: string) => void;
  /**
   * Whether to render the search field. On by default; the ritual's Backlog
   * step turns it off (DEX-141), where the reader is being walked through a
   * short list of what is slipping rather than hunting for a task they already
   * have in mind.
   *
   * Only the field is dropped, not the search *state* — a host can still seed
   * `search` while hiding the box, and `searchTasksByTitle` is a no-op at the
   * empty default either way.
   */
  showSearch?: boolean;
  /**
   * **Declares that this drawer is mounted under an animated opacity** — not a
   * style knob. Liquid glass is a `UIVisualEffectView` sampling what is behind
   * it and cannot do that through a non-opaque ancestor layer, so a row's "+"
   * washes out to a bare glyph; the flag forces the plain bordered circle
   * instead (see `GlassIconButton`). Only the ritual's Backlog step qualifies
   * (DEX-150) — every other host docks the drawer under nothing animated, and
   * setting it there would flatten glass that works and looks right.
   */
  solid?: boolean;
};

/**
 * Shared task-drawer content: Filter/Group/Search controls over every
 * incomplete task not scheduled onto a day the host already shows (see
 * `daysOnScreen`), with a tap-to-schedule affordance
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
  // self-managed (docked large-screen pane) — same optional-controlled shape
  // as a standard input.
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
  // Drives the "+" button's alarm prompt. Independent of the drag path, which
  // routes through `DragScheduleProvider`'s own copy — this drawer renders on
  // small screens too, where there is no provider.
  const { changeSchedule, confirmationProps } = useScheduleChange(updateTask);
  // The `?? [date]` fallback lives inside the memo: as an inline prop default
  // it would allocate a fresh array every render and defeat it.
  const today = useToday();
  const tasks = useMemo(
    () =>
      filterTasks(
        selectBacklogTasks(allTasks, daysOnScreen ?? [date]),
        filterId,
        today,
      ),
    [allTasks, date, daysOnScreen, filterId, today],
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
    ({ item, index }: { item: TDrawerListItem; index: number }) => {
      if (item.type === "header") {
        return (
          <Text
            style={[
              theme.fonts.title,
              styles.groupTitle,
              {
                color: theme.colors.textSecondary,
                // Tops the row separator up to the group step: `lg` separates
                // groups where `sm` separates rows within one (see
                // docs/design.md, "Spacing"), and the separator has already
                // contributed its `sm`. Without it a group's heading sat as
                // close to the previous group's last task as that task sat to
                // its own neighbours, and the groups ran together.
                //
                // Not on the first row, which has nothing above it to separate
                // from — and this is a *recycled* row, so the margin has to be
                // computed per render rather than baked into the stylesheet.
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
              // FlashList recycles a row by reusing its React key from a pool
              // and re-rendering with new props — it does NOT remount, and
              // `keyExtractor` only sets FlashList's own stableId, not this
              // key. Without keying here, `TaskCard`'s inline-edit state and
              // any focused input survive the swap and get committed against
              // whichever task landed in the recycled row — and drax, which
              // caches a view's props when it registers, would keep dragging
              // whichever task first mounted in the cell (DEX-77).
              key={task.id}
              task={task}
              onUpdate={(diff) => updateTask({ id: task.id, ...diff })}
              onDuplicate={() => createTask(duplicateTaskInput(task))}
              onPromoteSubtask={(promoted) => createTask(promoted)}
              onDelete={() => deleteTask(task.id)}
            />
          </View>
          {/* Names the target day rather than saying "this day" — on the Week
              tab the drawer sits beside seven of them (DEX-96) — and writes
              through `changeSchedule` rather than `updateTask` for the alarm
              prompt (DEX-77). Both rules now live in `TaskScheduleButton`,
              which the ritual's Open tasks step draws two more of. */}
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

  // Re-derive the list from a control and the old scroll offset is meaningless:
  // the rows under it are different rows. Grouping is the clearest case — the
  // whole list re-sections and, halfway down, the user lands in the middle of
  // some group they didn't pick — but a filter or a search narrows it just as
  // completely.
  //
  // Keyed on the three *inputs*, deliberately not on the derived `listItems`:
  // that identity also changes when a task is edited, so checking a task off
  // would yank the list back to the top under the user's finger.
  const listRef = useRef<FlashListRef<TDrawerListItem>>(null);
  useEffect(() => {
    listRef.current?.scrollToTop({ animated: false });
  }, [filterId, groupBy, search]);

  // `container`'s own padding sits inside a pane that itself extends
  // behind the tab bar, so it doesn't clear it — the inset has to go on the
  // scrollable content on top of that. Memoized like this list's other props
  // (renderItem/keyExtractor/getItemType): FlashList is wrapped in React.memo,
  // so a fresh object each render would re-render the whole recycler on every
  // keystroke in the search field.
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
          // The cluster's tail carries the step down to the list, so it moves
          // to whichever control is last: the search field when it is there,
          // this row when it isn't. Dropped entirely, the first card sat at the
          // container's in-group `sm` and read as one more control.
          showSearch ? null : clusterTailStyle,
        ]}
        testID="drawer-controls"
      >
        <DrawerControl
          label="Filter"
          title={titleFor(FILTER_META, filterId)}
          options={filterMenuOptions(filterId, setFilterId)}
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
          // Filter, Group and Search are one cluster of controls; the list
          // below is a different thing entirely, and at the container's
          // in-group `sm` the first card read as one more control. Tops that up
          // to the group step, the same way a group heading does — see
          // docs/design.md, "Spacing". Supplied here rather than inside
          // `TextInput`, which is shared app-wide and owns no spacing of its
          // own.
          style={clusterTailStyle}
        />
      ) : null}
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
      {/* Drives the "+" button's alarm prompt. A child of the drawer (unlike
          the drag path's modal, which is a sibling of its DraxProvider) —
          nothing here is animated or transformed for it to anchor to. */}
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
  // `flex: 1` bounds this to the sheet/pane's height; whichever child ends up
  // scrollable (the FlashList branch — the loading/empty branches are small,
  // static content with no need to scroll) fills the remaining space below
  // the controls/search. `padding` + inline `gap` reproduce what used to be
  // the ScrollView's `contentContainerStyle` spacing.
  container: {
    flex: 1,
  },
  controls: {
    flexDirection: "row",
  },
  // Width only. **Both** buttons must also be given `height: theme.controls.md`
  // inline, and they have to agree: the native `@expo/ui` menu host sizes
  // asynchronously and measures its RN child, so a flex-only trigger has no
  // height until a bounded ancestor resolves one — which the bottom sheet never
  // does, collapsing the button to ~2pt and untappable (same reason
  // StatusButton/ListButton/DayViewSwitcher pin theirs). DEX-61 dropped the
  // height from both and restored it on Filter alone, which is what left the
  // pair mismatched in the docked pane (DEX-106).
  controlButton: {
    flex: 1,
  },
  // The rest of the button is themed inline — see `controlButtonSurface` above
  // for the radius, border color, and horizontal padding. `alignSelf: stretch`
  // fills the menu's width.
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
