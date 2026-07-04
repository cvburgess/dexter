import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";

import TodayScreen from "@/app/(app)/(tabs)/today";
import { taskFiltersForDate, useTasks } from "@/hooks/useTasks";

// useTasks imports the supabase client from useAuth, which reads the app's
// URI scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useTasks", () => ({
  ...jest.requireActual("@/hooks/useTasks"),
  useTasks: jest.fn(),
}));
jest.mock("@/hooks/useLists", () => ({
  useLists: () => [
    [],
    {
      createList: jest.fn(),
      deleteList: jest.fn(),
      updateList: jest.fn(),
      getListById: () => undefined,
    },
  ],
}));

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;

const task: TTask = {
  id: "task-1",
  title: "Write the report",
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.URGENT,
  scheduledFor: "2026-07-03",
  status: ETaskStatus.TODO,
  templateId: null,
};

describe("TodayScreen", () => {
  beforeEach(() => {
    mockUseTasks.mockReturnValue([
      [],
      {
        createTask: jest.fn(),
        deleteTask: jest.fn(),
        updateTask: jest.fn(),
        updateTasks: jest.fn(),
      },
    ]);
  });

  it("queries tasks scheduled for today by default", () => {
    render(<TodayScreen />);

    expect(mockUseTasks).toHaveBeenCalledWith({
      filters: taskFiltersForDate(Temporal.Now.plainDateISO()),
    });
  });

  it("shows an empty state when there are no tasks for the day", () => {
    const screen = render(<TodayScreen />);

    expect(screen.getByText("No tasks scheduled for this day.")).toBeTruthy();
  });

  it("renders a card for every task returned for the day", () => {
    mockUseTasks.mockReturnValue([
      [task],
      {
        createTask: jest.fn(),
        deleteTask: jest.fn(),
        updateTask: jest.fn(),
        updateTasks: jest.fn(),
      },
    ]);

    const screen = render(<TodayScreen />);

    expect(screen.getByText("Write the report")).toBeTruthy();
    expect(screen.queryByText("No tasks scheduled for this day.")).toBeNull();
  });

  it("re-queries tasks for the new date after navigating a day forward", () => {
    const screen = render(<TodayScreen />);

    fireEvent.press(screen.getByLabelText("Next day"));

    expect(mockUseTasks).toHaveBeenLastCalledWith({
      filters: taskFiltersForDate(Temporal.Now.plainDateISO().add({ days: 1 })),
    });
  });
});
