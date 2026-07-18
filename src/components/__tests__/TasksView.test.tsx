import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert, Text, TouchableOpacity } from "react-native";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { usePreferences } from "@/hooks/usePreferences";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";

import { TasksView } from "../TasksView";

// useTasks imports the supabase client from useAuth, which reads the app's
// URI scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useTasks", () => ({
  ...jest.requireActual<typeof import("@/hooks/useTasks")>("@/hooks/useTasks"),
  useTasks: jest.fn(),
}));
jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));

const mockDeleteTemplate = jest.fn();
jest.mock("@/hooks/useTemplates", () => ({ useTemplates: jest.fn() }));

// The habit tracker is exercised on its own; stub it here to a marker so
// TasksView's `enableHabits` gating is still testable.
const mockHabitTracker = () => <Text>habit-tracker</Text>;
jest.mock("@/components/HabitTracker", () => ({
  HabitTracker: () => mockHabitTracker(),
}));

// TaskCard wraps a native menu (MoreMenu) that can't be driven from a unit
// test; stub it to a title + delete trigger so TasksView's list rendering and
// delete wiring can be exercised. TaskCard's own rendering is covered by its
// own tests.
const mockTaskCard = ({
  task,
  onDelete,
}: {
  task: TTask;
  onDelete: () => void;
}) => (
  <>
    <Text>{task.title}</Text>
    <TouchableOpacity
      accessibilityLabel={`delete-${task.id}`}
      onPress={onDelete}
    >
      <Text>delete</Text>
    </TouchableOpacity>
  </>
);
jest.mock("../TaskCard", () => ({
  TaskCard: (props: Parameters<typeof mockTaskCard>[0]) => mockTaskCard(props),
}));

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUseTemplates = useTemplates as jest.MockedFunction<
  typeof useTemplates
>;

const mockDeleteTask = jest.fn();

const tasksResult = (tasks: TTask[] = [], isLoading = false) =>
  [
    tasks,
    {
      createTask: jest.fn(),
      deleteTask: mockDeleteTask,
      isLoading,
      updateTask: jest.fn(),
      updateTasks: jest.fn(),
    },
  ] as ReturnType<typeof useTasks>;

const preferences = (
  overrides: { enableHabits?: boolean } = {},
): ReturnType<typeof usePreferences> =>
  [
    { enableHabits: true, ...overrides },
    { updatePreferences: jest.fn() },
  ] as never;

const task = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  title: "Write the report",
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.URGENT,
  // Matches this suite's `date` — TasksView now filters the canonical fetch
  // down to tasks scheduled for the viewed day client-side (DEX-57), so a
  // fixture task must be scheduled for that day to appear.
  scheduledFor: "2026-07-13",
  status: ETaskStatus.TODO,
  templateId: null,
  ...overrides,
});

const confirmAlert = () =>
  jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    buttons?.find((b) => b.style === "destructive")?.onPress?.();
  });

const cancelAlert = () =>
  jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    buttons?.find((b) => b.style === "cancel")?.onPress?.();
  });

describe("TasksView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTasks.mockReturnValue(tasksResult());
    mockUsePreferences.mockReturnValue(preferences());
    mockUseTemplates.mockReturnValue([
      [],
      {
        createTemplate: jest.fn(),
        createTemplateFromTask: jest.fn(),
        deleteTemplate: mockDeleteTemplate,
        getTemplateById: () => undefined,
        isLoading: false,
        updateTemplate: jest.fn(),
      },
    ] as ReturnType<typeof useTemplates>);
  });

  const date = Temporal.PlainDate.from("2026-07-13");

  it("shows an empty state when there are no tasks for the day", () => {
    const screen = render(<TasksView date={date} />);
    expect(screen.getByText("No tasks scheduled for this day.")).toBeTruthy();
  });

  it("does not show the empty state while tasks are loading", () => {
    mockUseTasks.mockReturnValue(tasksResult([], true));
    const screen = render(<TasksView date={date} />);
    expect(screen.queryByText("No tasks scheduled for this day.")).toBeNull();
  });

  it("renders a card for every task returned for the day", () => {
    mockUseTasks.mockReturnValue(tasksResult([task()]));
    const screen = render(<TasksView date={date} />);
    expect(screen.getByText("Write the report")).toBeTruthy();
    expect(screen.queryByText("No tasks scheduled for this day.")).toBeNull();
  });

  it("shows the habit tracker when habits are enabled", () => {
    const screen = render(<TasksView date={date} />);
    expect(screen.getByText("habit-tracker")).toBeTruthy();
  });

  it("hides the habit tracker when habits are disabled", () => {
    mockUsePreferences.mockReturnValue(preferences({ enableHabits: false }));
    const screen = render(<TasksView date={date} />);
    expect(screen.queryByText("habit-tracker")).toBeNull();
  });

  it("deletes a one-off task once the confirmation is accepted", async () => {
    confirmAlert();
    mockUseTasks.mockReturnValue(tasksResult([task()]));
    const screen = render(<TasksView date={date} />);

    fireEvent.press(screen.getByLabelText("delete-task-1"));

    await waitFor(() => expect(mockDeleteTask).toHaveBeenCalledWith("task-1"));
    expect(mockDeleteTemplate).not.toHaveBeenCalled();
  });

  it("does not delete a task when the confirmation is cancelled", async () => {
    cancelAlert();
    mockUseTasks.mockReturnValue(tasksResult([task()]));
    const screen = render(<TasksView date={date} />);

    fireEvent.press(screen.getByLabelText("delete-task-1"));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(mockDeleteTask).not.toHaveBeenCalled();
  });

  it("also deletes the repeat template for a repeating task", async () => {
    confirmAlert();
    mockUseTasks.mockReturnValue(
      tasksResult([task({ templateId: "template-1" })]),
    );
    const screen = render(<TasksView date={date} />);

    fireEvent.press(screen.getByLabelText("delete-task-1"));

    await waitFor(() => expect(mockDeleteTask).toHaveBeenCalledWith("task-1"));
    expect(mockDeleteTemplate).toHaveBeenCalledWith("template-1");
  });
});
