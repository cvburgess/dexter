import { Temporal } from "@js-temporal/polyfill";
import { render } from "@testing-library/react-native";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";

import { TasksStep } from "../TasksStep";

// useTasks imports the supabase client from useAuth, which reads the app's URI
// scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useTasks", () => ({
  ...jest.requireActual<typeof import("@/hooks/useTasks")>("@/hooks/useTasks"),
  useTasks: jest.fn(),
}));
jest.mock("@/hooks/useTemplates", () => ({ useTemplates: jest.fn() }));

// TaskCard wraps native menu hosts that can't be driven from a unit test, and
// its own rendering is covered by its own suite. A title marker is all this
// file needs to tell "the list is showing" from "the empty state is showing".
jest.mock("../TaskCard", () => ({
  TaskCard: ({ task }: { task: TTask }) => {
    const { Text: RNText } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return <RNText>{task.title}</RNText>;
  },
}));

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockUseTemplates = useTemplates as jest.MockedFunction<
  typeof useTemplates
>;

const DATE = Temporal.PlainDate.from("2026-08-09");

const MESSAGE = "No tasks scheduled for today.";
const CTA = "Press “＋ New Task” to get started.";

const tasksResult = (tasks: TTask[] = [], isLoading = false) =>
  [
    tasks,
    {
      createTask: jest.fn(),
      deleteTask: jest.fn(),
      isError: false,
      isLoading,
      refetch: jest.fn(),
      updateTask: jest.fn(),
      updateTasks: jest.fn(),
    },
  ] as ReturnType<typeof useTasks>;

const task = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  title: "Write the report",
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.URGENT,
  scheduledFor: DATE.toString(),
  status: ETaskStatus.TODO,
  subtasks: [],
  templateId: null,
  url: null,
  ...overrides,
});

describe("TasksStep", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTasks.mockReturnValue(tasksResult());
    mockUseTemplates.mockReturnValue([
      [],
      {
        createTemplate: jest.fn(),
        createNextOccurrence: jest.fn(),
        deleteTemplate: jest.fn(),
        getTemplateById: jest.fn(),
        isError: false,
        isLoading: false,
        refetch: jest.fn(),
        updateTemplate: jest.fn(),
      },
    ] as ReturnType<typeof useTemplates>);
  });

  // The step's own copy, and the reason it needed `emptyAction` at all: the
  // ritual points at the global "＋ New Task" button rather than growing one of
  // its own (DEX-144), so an empty day has to say where that button is.
  it("points an empty day at the global New Task button", () => {
    const screen = render(<TasksStep date={DATE} />);

    expect(screen.getByText(MESSAGE)).toBeTruthy();
    expect(screen.getByText(CTA)).toBeTruthy();
  });

  // `emptyAction` renders inside `EmptyScreen`, which the list branch replaces
  // wholesale — the guard is that adding children to that branch didn't leave
  // the prompt hanging under a day that already has tasks in it.
  it("drops the prompt once the day has tasks", () => {
    mockUseTasks.mockReturnValue(tasksResult([task()]));
    const screen = render(<TasksStep date={DATE} />);

    expect(screen.getByText("Write the report")).toBeTruthy();
    expect(screen.queryByText(MESSAGE)).toBeNull();
    expect(screen.queryByText(CTA)).toBeNull();
  });

  // `useTasks` serves an empty placeholder array while the query resolves, so
  // testing the empty state ahead of `isLoading` would tell someone with a full
  // day to go and make their first task.
  it("says nothing while the tasks are still loading", () => {
    mockUseTasks.mockReturnValue(tasksResult([], true));
    const screen = render(<TasksStep date={DATE} />);

    expect(screen.queryByText(MESSAGE)).toBeNull();
    expect(screen.queryByText(CTA)).toBeNull();
  });
});
