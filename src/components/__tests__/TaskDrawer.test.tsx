import { FlashList } from "@shopify/flash-list";
import { Temporal } from "@js-temporal/polyfill";
import { weekDays } from "@/utils/weekStartEnd";
import { act, fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import type { TextStyle, ViewStyle } from "react-native";

import { renderWithBottomInset } from "@/testUtils/renderWithBottomInset";
import { themes } from "@/utils/theme";

import { TGoal } from "@/api/goals";
import { TList } from "@/api/lists";
import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { useGoals } from "@/hooks/useGoals";
import { useLists } from "@/hooks/useLists";
import { useTasks } from "@/hooks/useTasks";

import type { TIconMenuSection } from "../IconMenu.types";
import {
  filterMenuOptions,
  groupMenuOptions,
  groupTasks,
  searchTasksByTitle,
  TaskDrawer,
} from "../TaskDrawer";

// useTasks imports the supabase client from useAuth, which reads the app's
// URI scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useTasks", () => ({
  ...jest.requireActual<typeof import("@/hooks/useTasks")>("@/hooks/useTasks"),
  useTasks: jest.fn(),
}));
jest.mock("@/hooks/useLists", () => ({ useLists: jest.fn() }));
jest.mock("@/hooks/useGoals", () => ({ useGoals: jest.fn() }));

// Native menu host isn't driveable; capture sections + style — the menu host
// sizes its RN child, so the height here is what keeps it tappable (DEX-106).
const mockIconMenu = jest.fn(
  (props: {
    accessibilityLabel?: string;
    sections?: TIconMenuSection[];
    style?: ViewStyle | ViewStyle[];
    children: ReactNode;
  }) => props.children,
);
jest.mock("../IconMenu", () => ({
  IconMenu: (props: Parameters<typeof mockIconMenu>[0]) => mockIconMenu(props),
}));

/** The resolved color of a control button's label. */
const labelColor = (screen: ReturnType<typeof render>, label: string) =>
  StyleSheet.flatten(screen.getByText(label).props.style as TextStyle[]).color;

/** The resolved border color of the bordered box around a control's label. */
const outlineColor = (screen: ReturnType<typeof render>, testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID).props.style as ViewStyle[])
    .borderColor;

/** The bottom margin on the Filter/Group row — the cluster's tail when there is no search field below it. */
const rowMarginBottom = (screen: ReturnType<typeof render>) =>
  StyleSheet.flatten(
    screen.getByTestId("drawer-controls").props.style as ViewStyle[],
  ).marginBottom;

/** The style handed to a captured IconMenu trigger, flattened. */
const triggerStyle = (label: string) =>
  StyleSheet.flatten(
    mockIconMenu.mock.calls.find(
      ([props]) => props.accessibilityLabel === label,
    )?.[0].style,
  );

/** Invokes a filter option's onSelect from the captured Filter IconMenu. */
const selectFilterOption = (id: string) => {
  const filterMenu = mockIconMenu.mock.calls.find(
    ([props]) => props.accessibilityLabel === "Filter",
  )?.[0];
  filterMenu?.sections
    ?.flatMap((section) => section.options)
    .find((option) => option.id === id)
    ?.onSelect();
};

/** Invokes a grouping option's onSelect from the captured Group IconMenu. */
const selectGroupOption = (id: string) => {
  const groupMenu = mockIconMenu.mock.calls.find(
    ([props]) => props.accessibilityLabel === "Group",
  )?.[0];
  groupMenu?.sections
    ?.flatMap((section) => section.options)
    .find((option) => option.id === id)
    ?.onSelect();
};

// TaskCard wraps a native menu that can't be driven here; stub it to its
// title — TaskCard's own rendering is covered by its own tests.
const mockTaskCard = ({ task }: { task: TTask }) => <Text>{task.title}</Text>;
jest.mock("../TaskCard", () => ({
  TaskCard: (props: Parameters<typeof mockTaskCard>[0]) => mockTaskCard(props),
}));

// A jest.fn so props are assertable, not just pressable — `solid` never
// reaches the DOM off iOS, so the call is the only place it's visible.
const mockGlassIconButton = jest.fn(
  ({
    accessibilityLabel,
    onPress,
  }: {
    accessibilityLabel: string;
    onPress?: () => void;
    solid?: boolean;
  }) => (
    <TouchableOpacity accessibilityLabel={accessibilityLabel} onPress={onPress}>
      <Text>{accessibilityLabel}</Text>
    </TouchableOpacity>
  ),
);
jest.mock("../GlassIconButton", () => ({
  GlassIconButton: (props: Parameters<typeof mockGlassIconButton>[0]) =>
    mockGlassIconButton(props),
}));

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockUseLists = useLists as jest.MockedFunction<typeof useLists>;
const mockUseGoals = useGoals as jest.MockedFunction<typeof useGoals>;

const mockUpdateTask = jest.fn();

const task = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  title: "Write report",
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.URGENT,
  scheduledFor: null,
  status: ETaskStatus.TODO,
  subtasks: [],
  templateId: null,
  url: null,
  ...overrides,
});

const list = (overrides: Partial<TList> = {}): TList => ({
  id: "list-1",
  title: "Work",
  emoji: "💼",
  isArchived: false,
  createdAt: "",
  ...overrides,
});

const goal = (overrides: Partial<TGoal> = {}): TGoal => ({
  id: "goal-1",
  title: "Ship it",
  emoji: "🚀",
  isArchived: false,
  createdAt: "",
  ...overrides,
});

const listContentStyle = (screen: ReturnType<typeof render>) =>
  StyleSheet.flatten(
    screen.UNSAFE_getByType(FlashList).props
      .contentContainerStyle as ViewStyle[],
  );

const tasksResult = (
  tasks: TTask[] = [],
  isLoading = false,
): ReturnType<typeof useTasks> =>
  [
    tasks,
    {
      createTask: jest.fn(),
      deleteTask: jest.fn(),
      isError: false,
      isLoading,
      refetch: jest.fn(),
      updateTask: mockUpdateTask,
      updateTasks: jest.fn(),
    },
  ] as never;

describe("filterMenuOptions", () => {
  it("lists every legacy filter and marks the selected one", () => {
    const options = filterMenuOptions("overdue", jest.fn());

    expect(options.map((o) => o.id)).toEqual([
      "none",
      "overdue",
      "dueSoon",
      "leftBehind",
      "unscheduled",
    ]);
    expect(options.find((o) => o.id === "overdue")?.isSelected).toBe(true);
    expect(options.find((o) => o.id === "none")?.isSelected).toBe(false);
  });

  it("calls onSelect with the option's id", () => {
    const onSelect = jest.fn();
    filterMenuOptions("none", onSelect)
      .find((o) => o.id === "dueSoon")
      ?.onSelect();

    expect(onSelect).toHaveBeenCalledWith("dueSoon");
  });
});

describe("groupMenuOptions", () => {
  it("lists every grouping option and marks the selected one", () => {
    const options = groupMenuOptions("priority", jest.fn());

    expect(options.map((o) => o.id)).toEqual([
      "none",
      "listId",
      "priority",
      "goalId",
    ]);
    expect(options.find((o) => o.id === "priority")?.isSelected).toBe(true);
  });

  it("calls onSelect with the option's id", () => {
    const onSelect = jest.fn();
    groupMenuOptions("none", onSelect)
      .find((o) => o.id === "goalId")
      ?.onSelect();

    expect(onSelect).toHaveBeenCalledWith("goalId");
  });
});

describe("searchTasksByTitle", () => {
  const tasks = [
    task({ id: "1", title: "Write report" }),
    task({ id: "2", title: "Buy milk" }),
  ];

  it("returns every task when the search is empty", () => {
    expect(searchTasksByTitle(tasks, "")).toEqual(tasks);
    expect(searchTasksByTitle(tasks, "   ")).toEqual(tasks);
  });

  it("filters case-insensitively by title substring", () => {
    expect(searchTasksByTitle(tasks, "WRITE").map((t) => t.id)).toEqual(["1"]);
  });

  it("returns nothing when no title matches", () => {
    expect(searchTasksByTitle(tasks, "xyz")).toEqual([]);
  });

  // DEX-47: a Search result opens this drawer seeded with the RPC's query, so
  // this filter must agree with search_entries or hide the tapped task.
  it("requires every term but not their order, matching the search RPC", () => {
    const outOfOrder = [task({ id: "3", title: "Milk — remember to buy" })];

    expect(searchTasksByTitle(outOfOrder, "buy milk").map((t) => t.id)).toEqual(
      ["3"],
    );
    // Still an AND, not an OR: a term that appears nowhere excludes the task.
    expect(searchTasksByTitle(outOfOrder, "buy bread")).toEqual([]);
  });

  it("matches subtask titles, which the search RPC also covers", () => {
    const withSubtask = [
      task({
        id: "4",
        title: "Groceries",
        subtasks: [{ id: "s1", title: "Oat milk", done: false }],
      }),
    ];

    expect(searchTasksByTitle(withSubtask, "oat").map((t) => t.id)).toEqual([
      "4",
    ]);
  });
});

describe("groupTasks", () => {
  const tasks = [
    task({ id: "1", listId: "list-1", priority: ETaskPriority.URGENT }),
    task({
      id: "2",
      listId: null,
      priority: ETaskPriority.UNPRIORITIZED,
      goalId: null,
    }),
  ];

  it("returns a single unlabeled group for no grouping", () => {
    expect(groupTasks(tasks, "none", [], [])).toEqual([
      { id: "all", title: "", tasks },
    ]);
  });

  it("returns nothing for no grouping when there are no tasks", () => {
    expect(groupTasks([], "none", [], [])).toEqual([]);
  });

  it("groups by list, including a No List group, dropping empty groups", () => {
    const groups = groupTasks(tasks, "listId", [list()], []);

    expect(groups.map((g) => g.title)).toEqual(["💼 Work", "No List"]);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["1"]);
    expect(groups[1].tasks.map((t) => t.id)).toEqual(["2"]);
  });

  it("drops a list with no matching tasks", () => {
    const groups = groupTasks(
      tasks,
      "listId",
      [list(), list({ id: "list-2", title: "Empty" })],
      [],
    );

    expect(groups.map((g) => g.title)).toEqual(["💼 Work", "No List"]);
  });

  it("buckets a task referencing an archived (no-longer-fetched) list into No List instead of dropping it", () => {
    // useLists() only fetches non-archived lists, so an archived list a task
    // still points to is absent from `lists` — the task must not disappear.
    const archivedListTasks = [task({ id: "1", listId: "archived-list" })];
    const groups = groupTasks(archivedListTasks, "listId", [list()], []);

    expect(groups.map((g) => g.title)).toEqual(["No List"]);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["1"]);
  });

  it("groups by goal, including a No Goal group", () => {
    const goalTasks = [
      task({ id: "1", goalId: "goal-1" }),
      task({ id: "2", goalId: null }),
    ];
    const groups = groupTasks(goalTasks, "goalId", [], [goal()]);

    expect(groups.map((g) => g.title)).toEqual(["Ship it", "No Goal"]);
  });

  it("buckets a task referencing an archived goal into No Goal instead of dropping it", () => {
    const archivedGoalTasks = [task({ id: "1", goalId: "archived-goal" })];
    const groups = groupTasks(archivedGoalTasks, "goalId", [], [goal()]);

    expect(groups.map((g) => g.title)).toEqual(["No Goal"]);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["1"]);
  });

  it("groups by priority in urgency order, dropping unused priorities", () => {
    const groups = groupTasks(tasks, "priority", [], []);

    expect(groups.map((g) => g.title)).toEqual(["Urgent", "Unprioritized"]);
  });
});

describe("TaskDrawer", () => {
  const date = Temporal.PlainDate.from("2026-07-16");

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLists.mockReturnValue([
      [],
      {
        createList: jest.fn(),
        deleteList: jest.fn(),
        getListById: () => undefined,
        isLoading: false,
        updateList: jest.fn(),
      },
    ] as never);
    mockUseGoals.mockReturnValue([
      [],
      {
        createGoal: jest.fn(),
        deleteGoal: jest.fn(),
        getGoalById: () => undefined,
        updateGoal: jest.fn(),
      },
    ] as never);
    mockUseTasks.mockReturnValue(tasksResult());
  });

  it("shows an empty state when there are no tasks", () => {
    const screen = render(<TaskDrawer date={date} />);
    expect(
      screen.getByText("Nothing here — you're all caught up."),
    ).toBeTruthy();
  });

  // DEX-106: the menu host measures its RN child, so a heightless trigger
  // collapses to ~2pt in the bottom sheet. DEX-61 restored it on Filter only.
  it("gives both the Filter and Group triggers the same pinned height", () => {
    render(<TaskDrawer date={date} />);

    const filter = triggerStyle("Filter");
    const group = triggerStyle("Group");

    expect(filter.height).toBeGreaterThan(0);
    expect(group.height).toBe(filter.height);
  });

  describe("daysOnScreen scoping (DEX-96)", () => {
    // 2026-07-27 (Mon) – 2026-08-02 (Sun).
    const monday = Temporal.PlainDate.from("2026-07-27");
    const inWeek = task({
      id: "in-week",
      title: "Inside the week",
      scheduledFor: "2026-07-30",
    });
    const outOfWeek = task({
      id: "out-of-week",
      title: "Outside the week",
      scheduledFor: "2026-08-10",
    });

    it("hides every task scheduled inside the week", () => {
      mockUseTasks.mockReturnValue(tasksResult([inWeek, outOfWeek]));

      const screen = render(
        <TaskDrawer date={monday} daysOnScreen={weekDays(monday)} />,
      );

      expect(screen.getByText("Outside the week")).toBeTruthy();
      expect(screen.queryByText("Inside the week")).toBeNull();
    });

    it("still shows a same-week task when no daysOnScreen is given", () => {
      // Without the prop the drawer scopes to [date] alone, so a task on another
      // day of that week belongs in the Today backlog.
      mockUseTasks.mockReturnValue(tasksResult([inWeek, outOfWeek]));

      const screen = render(<TaskDrawer date={monday} />);

      expect(screen.getByText("Inside the week")).toBeTruthy();
      expect(screen.getByText("Outside the week")).toBeTruthy();
    });

    it("schedules onto `date`, not every day on screen", () => {
      mockUseTasks.mockReturnValue(tasksResult([outOfWeek]));

      const screen = render(
        <TaskDrawer date={monday} daysOnScreen={weekDays(monday)} />,
      );
      fireEvent.press(
        screen.getByLabelText('Schedule "Outside the week" for Monday, Jul 27'),
      );

      expect(mockUpdateTask).toHaveBeenCalledWith({
        id: "out-of-week",
        scheduledFor: "2026-07-27",
      });
    });
  });

  it("shows a loading indicator (not the empty state) while the first fetch is in flight", () => {
    mockUseTasks.mockReturnValue(tasksResult([], true));
    const screen = render(<TaskDrawer date={date} />);

    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(
      screen.queryByText("Nothing here — you're all caught up."),
    ).toBeNull();
  });

  it("renders a card for every task returned", () => {
    mockUseTasks.mockReturnValue(tasksResult([task()]));
    const screen = render(<TaskDrawer date={date} />);

    expect(screen.getByText("Write report")).toBeTruthy();
    expect(
      screen.queryByText("Nothing here — you're all caught up."),
    ).toBeNull();
  });

  // The drawer reserves whatever bottom inset its host publishes, so the last
  // row clears the native tab bar in the docked pane (DEX-91).
  it("reserves the host's bottom inset below the list's last row", () => {
    mockUseTasks.mockReturnValue(tasksResult([task()]));
    const screen = renderWithBottomInset(34, <TaskDrawer date={date} />);

    expect(listContentStyle(screen).paddingBottom).toBe(34);
  });

  it("renders every row of a multi-task list through the flattened FlashList data", () => {
    mockUseTasks.mockReturnValue(
      tasksResult([
        task({ id: "1", title: "Write report" }),
        task({ id: "2", title: "Buy milk" }),
        task({ id: "3", title: "Call dentist" }),
      ]),
    );
    const screen = render(<TaskDrawer date={date} />);

    expect(screen.getByText("Write report")).toBeTruthy();
    expect(screen.getByText("Buy milk")).toBeTruthy();
    expect(screen.getByText("Call dentist")).toBeTruthy();
  });

  it("fetches the canonical task set with no arguments", () => {
    render(<TaskDrawer date={date} />);

    expect(mockUseTasks).toHaveBeenCalledWith();
  });

  it("excludes tasks scheduled for the viewed day and completed tasks by default", () => {
    mockUseTasks.mockReturnValue(
      tasksResult([
        task({ id: "1", title: "Scheduled today", scheduledFor: "2026-07-16" }),
        task({ id: "2", title: "Done elsewhere", status: ETaskStatus.DONE }),
        task({ id: "3", title: "Backlog item", scheduledFor: null }),
      ]),
    );
    const screen = render(<TaskDrawer date={date} />);

    expect(screen.getByText("Backlog item")).toBeTruthy();
    expect(screen.queryByText("Scheduled today")).toBeNull();
    expect(screen.queryByText("Done elsewhere")).toBeNull();
  });

  it("schedules a task for the viewed day when its schedule button is pressed", () => {
    mockUseTasks.mockReturnValue(tasksResult([task()]));
    const screen = render(<TaskDrawer date={date} />);

    fireEvent.press(
      screen.getByLabelText('Schedule "Write report" for Thursday, Jul 16'),
    );

    expect(mockUpdateTask).toHaveBeenCalledWith({
      id: "task-1",
      scheduledFor: "2026-07-16",
    });
  });

  // `solid` says "this drawer is under an animated opacity" (DEX-150, Backlog
  // step only) — its look is iOS-only/invisible to Jest; this covers the flag.
  describe("the row button's solid flag", () => {
    // Throws rather than undefined when the button is missing — else the
    // negative case below would pass on a drawer rendering no rows at all.
    const solidOfSchedule = () => {
      const call = mockGlassIconButton.mock.calls.find(
        ([props]) =>
          props.accessibilityLabel ===
          'Schedule "Write report" for Thursday, Jul 16',
      );
      if (!call) throw new Error("The row's schedule button never rendered");
      return call[0].solid;
    };

    it("passes solid down to the row's schedule button when set", () => {
      mockUseTasks.mockReturnValue(tasksResult([task()]));
      render(<TaskDrawer date={date} solid />);

      expect(solidOfSchedule()).toBe(true);
    });

    it("leaves it off by default, so a docked drawer keeps its glass", () => {
      mockUseTasks.mockReturnValue(tasksResult([task()]));
      render(<TaskDrawer date={date} />);

      expect(solidOfSchedule()).toBeFalsy();
    });
  });

  // The "+" owes the same alarm prompt the card's menu gives — it used to
  // call updateTask directly and strand the alarm (DEX-77).
  describe("scheduling a task that has an alarm", () => {
    // ConfirmationModal renders nothing natively, so assert via the Alert spy;
    // restored in afterEach or it leaks into later tests.
    let alertSpy: jest.SpyInstance;

    /** Presses the "+" for a task carrying an alarm, and returns the prompt's buttons. */
    const pressSchedule = () => {
      alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
      mockUseTasks.mockReturnValue(
        tasksResult([task({ alarmTime: "09:00:00" })]),
      );
      const screen = render(<TaskDrawer date={date} />);
      fireEvent.press(
        screen.getByLabelText('Schedule "Write report" for Thursday, Jul 16'),
      );
      const [title, , buttons] = alertSpy.mock.calls[0] as [
        string,
        string,
        { text: string; onPress?: () => void }[],
      ];
      return { title, buttons };
    };

    const press = (
      buttons: { text: string; onPress?: () => void }[],
      label: string,
    ) => {
      const button = buttons.find((candidate) => candidate.text === label);
      if (!button) throw new Error(`No prompt button labelled "${label}"`);
      act(() => button.onPress?.());
    };

    afterEach(() => alertSpy?.mockRestore());

    it("asks before moving it rather than writing straight through", () => {
      const { title } = pressSchedule();

      expect(title).toBe("Reschedule task?");
      expect(mockUpdateTask).not.toHaveBeenCalled();
    });

    it("carries the alarm over when asked to keep it", () => {
      const { buttons } = pressSchedule();

      press(buttons, "Keep alarm");

      expect(mockUpdateTask).toHaveBeenCalledWith({
        id: "task-1",
        scheduledFor: "2026-07-16",
      });
    });

    it("clears the alarm when asked to unset it", () => {
      const { buttons } = pressSchedule();

      press(buttons, "Unset alarm");

      expect(mockUpdateTask).toHaveBeenCalledWith({
        id: "task-1",
        scheduledFor: "2026-07-16",
        alarmTime: null,
      });
    });

    it("leaves the task where it is when cancelled", () => {
      const { buttons } = pressSchedule();

      press(buttons, "Cancel");

      expect(mockUpdateTask).not.toHaveBeenCalled();
    });
  });

  it("applies a controlled filterId from the parent (Overdue)", () => {
    // The drawer filters against the real today, so derive the overdue date
    // from it rather than the fixed viewed day.
    const yesterday = Temporal.Now.plainDateISO().subtract({ days: 1 });
    mockUseTasks.mockReturnValue(
      tasksResult([
        task({ id: "1", title: "Overdue item", dueOn: yesterday.toString() }),
        task({ id: "2", title: "Not overdue", dueOn: null }),
      ]),
    );
    const screen = render(
      <TaskDrawer date={date} filterId="overdue" onFilterChange={jest.fn()} />,
    );

    expect(screen.getByText("Overdue item")).toBeTruthy();
    expect(screen.queryByText("Not overdue")).toBeNull();
  });

  it("routes filter selection through onFilterChange when controlled", () => {
    const onFilterChange = jest.fn();
    render(
      <TaskDrawer
        date={date}
        filterId="none"
        onFilterChange={onFilterChange}
      />,
    );

    selectFilterOption("overdue");

    expect(onFilterChange).toHaveBeenCalledWith("overdue");
  });

  // An applied filter used to be invisible until you opened the menu; only a
  // control off its `"none"` default wears the accent, label and outline together.
  it("accents a control's label and outline only while it is off its default", () => {
    const screen = render(
      <TaskDrawer date={date} filterId="overdue" onFilterChange={jest.fn()} />,
    );
    const { colors } = themes.dexter;

    expect(labelColor(screen, "Overdue")).toBe(colors.primary);
    expect(outlineColor(screen, "drawer-filter-surface")).toBe(colors.primary);

    expect(labelColor(screen, "No Grouping")).toBe(colors.text);
    expect(outlineColor(screen, "drawer-group-surface")).toBe(colors.border);
  });

  // The ritual's Backlog step drops the field (DEX-141); every other host keeps
  // it, so the default has to stay on.
  describe("the search field", () => {
    it("is rendered by default", () => {
      const screen = render(<TaskDrawer date={date} />);

      expect(screen.getByLabelText("Search")).toBeTruthy();
    });

    it("is dropped when showSearch is false", () => {
      const screen = render(<TaskDrawer date={date} showSearch={false} />);

      expect(screen.queryByLabelText("Search")).toBeNull();
    });

    // The field's tail holds the list a group step below the controls; hidden,
    // it moves to the controls row rather than disappearing.
    it("hands its bottom margin to the controls row when hidden", () => {
      const withSearch = render(<TaskDrawer date={date} />);
      // Read off the field rather than a token — what matters is the gap
      // survives, not what it resolves to on this density.
      const tail = StyleSheet.flatten(
        withSearch.getByLabelText("Search").props.style as ViewStyle,
      ).marginBottom;

      expect(tail).toBeGreaterThan(0);
      expect(rowMarginBottom(withSearch)).toBeUndefined();

      const withoutSearch = render(
        <TaskDrawer date={date} showSearch={false} />,
      );

      expect(rowMarginBottom(withoutSearch)).toBe(tail);
    });
  });

  // A group heading carries the group step above it, on top of the row
  // separator's own `sm`, or sections run together. The first heading excepted.
  it("separates a group heading from the group above it, but not the first", () => {
    mockUseTasks.mockReturnValue(
      tasksResult([
        task({ id: "1", title: "A", priority: ETaskPriority.URGENT }),
        task({ id: "2", title: "B", priority: ETaskPriority.UNPRIORITIZED }),
      ]),
    );
    const screen = render(<TaskDrawer date={date} />);

    act(() => selectGroupOption("priority"));

    const marginOf = (heading: string) =>
      StyleSheet.flatten(screen.getByText(heading).props.style as TextStyle[])
        .marginTop;

    // `space.lg - space.sm`: the separator already contributed `sm`.
    expect(marginOf("Urgent")).toBe(0);
    expect(marginOf("Unprioritized")).toBe(16);
  });
});
