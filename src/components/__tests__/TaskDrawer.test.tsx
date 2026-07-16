import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Text, TouchableOpacity } from "react-native";

import { TGoal } from "@/api/goals";
import { TList } from "@/api/lists";
import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { useGoals } from "@/hooks/useGoals";
import { useLists } from "@/hooks/useLists";
import { notScheduledForDateFilters, useTasks } from "@/hooks/useTasks";

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

// The native `@expo/ui` menu host can't be driven from a unit test (see
// ListButton.test); render only the trigger and cover selection wiring via
// the exported option-builder functions directly.
const mockIconMenu = jest.fn(
  (props: { children: ReactNode }) => props.children,
);
jest.mock("../IconMenu", () => ({
  IconMenu: (props: Parameters<typeof mockIconMenu>[0]) => mockIconMenu(props),
}));

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

const tasksResult = (tasks: TTask[] = []): ReturnType<typeof useTasks> =>
  [
    tasks,
    {
      createTask: jest.fn(),
      deleteTask: jest.fn(),
      isLoading: false,
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

  it("groups by goal, including a No Goal group", () => {
    const goalTasks = [
      task({ id: "1", goalId: "goal-1" }),
      task({ id: "2", goalId: null }),
    ];
    const groups = groupTasks(goalTasks, "goalId", [], [goal()]);

    expect(groups.map((g) => g.title)).toEqual(["Ship it", "No Goal"]);
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

  it("renders a card for every task returned", () => {
    mockUseTasks.mockReturnValue(tasksResult([task()]));
    const screen = render(<TaskDrawer date={date} />);

    expect(screen.getByText("Write report")).toBeTruthy();
    expect(
      screen.queryByText("Nothing here — you're all caught up."),
    ).toBeNull();
  });

  it("queries with the base not-scheduled-for-date filter by default", () => {
    render(<TaskDrawer date={date} />);

    expect(mockUseTasks).toHaveBeenCalledWith({
      filters: notScheduledForDateFilters(date),
    });
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
  });
});
