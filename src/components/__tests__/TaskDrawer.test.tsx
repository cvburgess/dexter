import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity } from "react-native";

import { TGoal } from "@/api/goals";
import { TList } from "@/api/lists";
import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { useGoals } from "@/hooks/useGoals";
import { useLists } from "@/hooks/useLists";
import { useTasks } from "@/hooks/useTasks";

import type { TIconMenuSection } from "../IconMenu.types";
import {
  dragActivation,
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

// The native `@expo/ui` menu host can't be driven from a unit test (see
// ListButton.test); render only the trigger, and capture the sections so a
// menu option's onSelect can be invoked directly.
const mockIconMenu = jest.fn(
  (props: {
    accessibilityLabel?: string;
    sections?: TIconMenuSection[];
    children: ReactNode;
  }) => props.children,
);
jest.mock("../IconMenu", () => ({
  IconMenu: (props: Parameters<typeof mockIconMenu>[0]) => mockIconMenu(props),
}));

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

// TaskCard wraps a native menu (MoreMenu) that can't be driven from a unit
// test (see TasksView.test); stub it to its title. TaskCard's own rendering
// is covered by its own tests.
const mockTaskCard = ({ task }: { task: TTask }) => <Text>{task.title}</Text>;
jest.mock("../TaskCard", () => ({
  TaskCard: (props: Parameters<typeof mockTaskCard>[0]) => mockTaskCard(props),
}));

const mockGlassIconButton = ({
  accessibilityLabel,
  onPress,
}: {
  accessibilityLabel: string;
  onPress?: () => void;
}) => (
  <TouchableOpacity accessibilityLabel={accessibilityLabel} onPress={onPress}>
    <Text>{accessibilityLabel}</Text>
  </TouchableOpacity>
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
  templateId: null,
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

const tasksResult = (
  tasks: TTask[] = [],
  isLoading = false,
): ReturnType<typeof useTasks> =>
  [
    tasks,
    {
      createTask: jest.fn(),
      deleteTask: jest.fn(),
      isLoading,
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

describe("dragActivation", () => {
  it("holds the press before dragging on native, so a flick still scrolls", () => {
    expect(dragActivation("ios")).toEqual({
      longPressDelay: 250,
      dragActivationFailOffset: 12,
    });
    expect(dragActivation("android").longPressDelay).toBe(250);
  });

  it("activates immediately on web", () => {
    expect(dragActivation("web").longPressDelay).toBe(0);
  });

  // Regression: RNGH checks `shouldFail()` before `shouldActivate()` and only
  // consults its long-press branch when `activateAfterLongPress > 0`. Shipping
  // both a 0 delay and a fail offset meant the pan failed at 12px of travel,
  // so the drag never started on web while native was fine.
  it("omits the fail offset whenever there is no long-press window to guard", () => {
    const platforms = ["web", "ios", "android", "macos", "windows"] as const;

    for (const platform of platforms) {
      const { longPressDelay, dragActivationFailOffset } =
        dragActivation(platform);
      expect(dragActivationFailOffset === undefined).toBe(longPressDelay === 0);
    }
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
      screen.getByLabelText('Schedule "Write report" for this day'),
    );

    expect(mockUpdateTask).toHaveBeenCalledWith({
      id: "task-1",
      scheduledFor: "2026-07-16",
    });
    expect(screen.queryByTestId("task-drag-task-1")).toBeNull();
  });

  // The button routes through useScheduleChange like every other reschedule
  // surface, so an alarm has to be resolved before the date moves (DEX-77) —
  // it used to write scheduledFor straight through and orphan the alarm.
  // Restored explicitly: the Jest config sets neither `restoreMocks` nor
  // `resetMocks`, so a spy's implementation otherwise leaks into every later
  // test in this file (`clearAllMocks` only wipes call records).
  afterEach(() => jest.restoreAllMocks());

  it("prompts before moving a task that has an alarm set", () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockUseTasks.mockReturnValue(
      tasksResult([task({ alarmTime: "09:00:00", scheduledFor: null })]),
    );
    const screen = render(<TaskDrawer date={date} />);

    fireEvent.press(
      screen.getByLabelText('Schedule "Write report" for this day'),
    );

    expect(mockUpdateTask).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(
      "Reschedule task?",
      expect.stringContaining("alarm"),
      expect.any(Array),
      expect.anything(),
    );
  });

  // Large screens drag the card onto the Tasks pane instead (DEX-77); the
  // button only exists on the small-screen sheet, where the drawer is a native
  // bottom sheet a drag can't escape.
  describe("enableDrag", () => {
    it("replaces the schedule button with a drag source", () => {
      mockUseTasks.mockReturnValue(tasksResult([task()]));
      const screen = render(<TaskDrawer date={date} enableDrag />);

      expect(
        screen.queryByLabelText('Schedule "Write report" for this day'),
      ).toBeNull();
      expect(screen.getByTestId("task-drag-task-1")).toBeTruthy();
      // The card itself still renders — the drag source wraps it.
      expect(screen.getByText("Write report")).toBeTruthy();
    });

    // The drop target reads `alarmTime` off the payload to decide whether to
    // prompt, so it has to carry the whole task, not just an id.
    it("carries the full task as the drag payload", () => {
      const dragged = task({ alarmTime: "09:00:00" });
      mockUseTasks.mockReturnValue(tasksResult([dragged]));
      const screen = render(<TaskDrawer date={date} enableDrag />);

      expect(screen.getByTestId("task-drag-task-1").props.payload).toEqual(
        dragged,
      );
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
});
