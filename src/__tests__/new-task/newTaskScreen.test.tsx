import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";

import { ETaskPriority } from "@/api/tasks";
import NewTaskScreen from "@/app/(app)/new-task";
import { useTasks } from "@/hooks/useTasks";

// useTasks imports the supabase client from useAuth, which reads the app's
// URI scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useTasks", () => ({ useTasks: jest.fn() }));
jest.mock("@/hooks/useLists", () => ({
  useLists: () => [
    [
      {
        id: "list-home",
        title: "Home",
        emoji: "🏠",
        isArchived: false,
        createdAt: "2026-01-01T00:00:00Z",
      },
    ],
    {
      createList: jest.fn(),
      deleteList: jest.fn(),
      updateList: jest.fn(),
      getListById: () => undefined,
    },
  ],
}));

const mockRouter = { back: jest.fn(), push: jest.fn() };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

// The @expo/ui date pickers are native components with no test doubles;
// control state logic is covered by the useNewTaskForm hook tests. The
// universal Host/Picker and expo-symbols are mocked globally in jest.setup.js.
jest.mock("@expo/ui/community/datetime-picker", () => ({
  DateTimePicker: () => null,
}));

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockCreateTask = jest.fn();

describe("NewTaskScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTasks.mockReturnValue([
      [],
      {
        createTask: mockCreateTask,
        deleteTask: jest.fn(),
        isLoading: false,
        updateTask: jest.fn(),
        updateTasks: jest.fn(),
      },
    ]);
  });

  it("does not create a task while the title is empty", () => {
    const screen = render(<NewTaskScreen />);

    fireEvent.press(screen.getByTestId("new-task-save"));

    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it("creates a task from the parsed title and dismisses the modal", () => {
    const today = Temporal.Now.plainDateISO();
    const screen = render(<NewTaskScreen />);

    fireEvent.changeText(
      screen.getByTestId("new-task-title"),
      "!! Write the spec #home due:2",
    );
    fireEvent.press(screen.getByTestId("new-task-save"));

    expect(mockCreateTask).toHaveBeenCalledWith({
      title: "Write the spec",
      priority: ETaskPriority.IMPORTANT,
      listId: "list-home",
      scheduledFor: today.toString(),
      dueOn: today.add({ days: 2 }).toString(),
    });
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("saves a manually selected priority over a typed token", () => {
    const screen = render(<NewTaskScreen />);

    fireEvent.changeText(screen.getByTestId("new-task-title"), "! Pay bills");
    fireEvent.press(screen.getByLabelText("Important"));
    fireEvent.press(screen.getByTestId("new-task-save"));

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Pay bills",
        priority: ETaskPriority.IMPORTANT,
      }),
    );
  });

  it("saves when the title input is submitted from the keyboard", () => {
    const screen = render(<NewTaskScreen />);

    fireEvent.changeText(screen.getByTestId("new-task-title"), "Pay bills");
    fireEvent(screen.getByTestId("new-task-title"), "submitEditing");

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Pay bills" }),
    );
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("skips query fetching for the task list", () => {
    render(<NewTaskScreen />);

    expect(mockUseTasks).toHaveBeenCalledWith({ skipQuery: true });
  });
});
