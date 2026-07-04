import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";

import { ETaskPriority } from "@/api/tasks";
import NewTaskScreen from "@/app/(app)/new-task";
import { useTasks } from "@/hooks/useTasks";

// useTasks imports the supabase client from useAuth, which reads the app's
// URI scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useTasks", () => ({ useTasks: jest.fn() }));

const homeList = {
  id: "list-home",
  title: "Home",
  emoji: "🏠",
  isArchived: false,
  createdAt: "2026-01-01T00:00:00Z",
};
const listsState = { isLoading: false };
jest.mock("@/hooks/useLists", () => ({
  useLists: () => [
    listsState.isLoading ? [] : [homeList],
    {
      createList: jest.fn(),
      deleteList: jest.fn(),
      updateList: jest.fn(),
      getListById: () => undefined,
      isLoading: listsState.isLoading,
    },
  ],
}));

const mockRouter = { back: jest.fn(), push: jest.fn() };
const mockNavigation = { setOptions: jest.fn() };
jest.mock("expo-router", () => ({
  useNavigation: () => mockNavigation,
  useRouter: () => mockRouter,
}));

// The header buttons are wired via navigation.setOptions on every render;
// grab the latest options to interact with them like the header would.
const headerOptions = () => mockNavigation.setOptions.mock.calls.at(-1)?.[0];

// The @expo/ui form controls are native components with no test doubles;
// control state logic is covered by the useNewTaskForm hook tests. They are
// mocked globally in jest.setup.js.

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockCreateTask = jest.fn();

describe("NewTaskScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listsState.isLoading = false;
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

  it("disables the header save button while the title is empty", () => {
    render(<NewTaskScreen />);

    const save = render(headerOptions().headerRight());
    fireEvent.press(save.getByTestId("modal-done-button"));

    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(headerOptions().unstable_headerRightItems()[0].disabled).toBe(true);
  });

  it("cancels from the header close button without creating a task", () => {
    render(<NewTaskScreen />);

    const close = render(headerOptions().headerLeft());
    fireEvent.press(close.getByTestId("modal-close-button"));

    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it("creates a task from the parsed title and dismisses the modal", () => {
    const today = Temporal.Now.plainDateISO();
    const screen = render(<NewTaskScreen />);

    fireEvent.changeText(
      screen.getByTestId("new-task-title"),
      "!! Write the spec #home due:2",
    );
    const save = render(headerOptions().headerRight());
    fireEvent.press(save.getByTestId("modal-done-button"));

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
    const save = render(headerOptions().headerRight());
    fireEvent.press(save.getByTestId("modal-done-button"));

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Pay bills",
        priority: ETaskPriority.IMPORTANT,
      }),
    );
  });

  it("only creates one task when save is pressed twice", () => {
    const screen = render(<NewTaskScreen />);

    fireEvent.changeText(screen.getByTestId("new-task-title"), "Pay bills");
    const save = render(headerOptions().headerRight());
    fireEvent.press(save.getByTestId("modal-done-button"));
    fireEvent.press(save.getByTestId("modal-done-button"));
    fireEvent(screen.getByTestId("new-task-title"), "submitEditing");

    expect(mockCreateTask).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it("does not save while lists are still loading", () => {
    listsState.isLoading = true;
    const screen = render(<NewTaskScreen />);

    fireEvent.changeText(screen.getByTestId("new-task-title"), "Pay #home");
    const save = render(headerOptions().headerRight());
    fireEvent.press(save.getByTestId("modal-done-button"));

    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(headerOptions().unstable_headerRightItems()[0].disabled).toBe(true);
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
