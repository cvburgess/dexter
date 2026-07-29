import { fireEvent, render } from "@testing-library/react-native";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import EditTaskScreen from "@/app/(app)/edit-task/[id]";
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
jest.mock("@/hooks/useLists", () => ({
  useLists: () => [
    [homeList],
    {
      createList: jest.fn(),
      deleteList: jest.fn(),
      updateList: jest.fn(),
      getListById: () => undefined,
      isLoading: false,
    },
  ],
}));

const mockRouter = { back: jest.fn(), push: jest.fn() };
const mockNavigation = { setOptions: jest.fn() };
const mockSearchParams: { current: Record<string, string> } = { current: {} };
const mockRedirect = jest.fn((_props: { href: string }) => null);
jest.mock("expo-router", () => ({
  Redirect: (props: { href: string }) => mockRedirect(props),
  useNavigation: () => mockNavigation,
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockSearchParams.current,
}));

// The header buttons are wired via navigation.setOptions on every render;
// grab the latest options to interact with them like the header would.
const headerOptions = () => mockNavigation.setOptions.mock.calls.at(-1)?.[0];

const pressSave = () => {
  const save = render(headerOptions().headerRight());
  fireEvent.press(save.getByTestId("modal-done-button"));
  return save;
};

const savedTask: TTask = {
  id: "task-1",
  alarmTime: null,
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.NEITHER,
  scheduledFor: "2026-07-03",
  status: ETaskStatus.TODO,
  subtasks: [],
  templateId: null,
  title: "Write the report",
};

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockUpdateTask = jest.fn();

/** Points the mocked hook at a task list and a loading state. */
const setTasks = (tasks: TTask[], isLoading = false) =>
  mockUseTasks.mockReturnValue([
    tasks,
    {
      createTask: jest.fn(),
      deleteTask: jest.fn(),
      isLoading,
      updateTask: mockUpdateTask,
      updateTasks: jest.fn(),
    },
  ]);

describe("EditTaskScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.current = { id: "task-1" };
    mockUpdateTask.mockImplementation((_diff, callbacks) => {
      callbacks?.onSuccess?.();
    });
    setTasks([savedTask]);
  });

  it("seeds the form from the saved task", () => {
    const screen = render(<EditTaskScreen />);

    expect(screen.getByTestId("edit-task-title").props.value).toBe(
      "Write the report",
    );
  });

  // The create modal autofocuses because the title is empty; here the form
  // opens filled, and raising the keyboard would cover the fields below it.
  it("does not autofocus the title", () => {
    const screen = render(<EditTaskScreen />);

    expect(screen.getByTestId("edit-task-title").props.autoFocus).toBeFalsy();
  });

  it("saves the whole field set against the task's id and dismisses", () => {
    const screen = render(<EditTaskScreen />);

    fireEvent.changeText(
      screen.getByTestId("edit-task-title"),
      "Ship the deck",
    );
    pressSave();

    expect(mockUpdateTask).toHaveBeenCalledWith(
      {
        id: "task-1",
        title: "Ship the deck",
        priority: ETaskPriority.NEITHER,
        listId: null,
        scheduledFor: "2026-07-03",
        dueOn: null,
        alarmTime: null,
        templateId: null,
        subtasks: [],
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(mockRouter.back).toHaveBeenCalled();
  });

  // Shorthand is create-only: a saved title is text the user already committed
  // to, not input waiting to be parsed (DEX-98).
  it("keeps shorthand characters in the title instead of parsing them", () => {
    setTasks([{ ...savedTask, title: "Ship it!! #home due:3" }]);
    const screen = render(<EditTaskScreen />);

    expect(screen.getByTestId("edit-task-title").props.value).toBe(
      "Ship it!! #home due:3",
    );

    pressSave();

    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Ship it!! #home due:3",
        priority: ETaskPriority.NEITHER,
        listId: null,
        dueOn: null,
      }),
      expect.anything(),
    );
  });

  it("disables save while the title is empty", () => {
    const screen = render(<EditTaskScreen />);

    fireEvent.changeText(screen.getByTestId("edit-task-title"), "   ");
    pressSave();

    expect(mockUpdateTask).not.toHaveBeenCalled();
    expect(headerOptions().unstable_headerRightItems()[0].disabled).toBe(true);
  });

  it("cancels from the header close button without writing", () => {
    render(<EditTaskScreen />);

    const close = render(headerOptions().headerLeft());
    fireEvent.press(close.getByTestId("modal-close-button"));

    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it("only writes once when save is pressed twice", () => {
    const screen = render(<EditTaskScreen />);

    const save = render(headerOptions().headerRight());
    fireEvent.press(save.getByTestId("modal-done-button"));
    fireEvent.press(save.getByTestId("modal-done-button"));
    fireEvent(screen.getByTestId("edit-task-title"), "submitEditing");

    expect(mockUpdateTask).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  // The write is optimistic, so a failure rolls the cache back — closing over
  // it would lose the user's edits with nothing to show for them.
  it("stays open and allows retrying when the save fails", () => {
    mockUpdateTask.mockImplementation((_diff, callbacks) => {
      callbacks?.onError?.(new Error("network error"));
    });
    const screen = render(<EditTaskScreen />);

    fireEvent.changeText(screen.getByTestId("edit-task-title"), "Renamed");
    const save = render(headerOptions().headerRight());
    fireEvent.press(save.getByTestId("modal-done-button"));

    expect(mockUpdateTask).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).not.toHaveBeenCalled();

    fireEvent.press(save.getByTestId("modal-done-button"));
    expect(mockUpdateTask).toHaveBeenCalledTimes(2);
  });

  it("saves when the title input is submitted from the keyboard", () => {
    const screen = render(<EditTaskScreen />);

    fireEvent.changeText(screen.getByTestId("edit-task-title"), "Renamed");
    fireEvent(screen.getByTestId("edit-task-title"), "submitEditing");

    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: "task-1", title: "Renamed" }),
      expect.anything(),
    );
  });

  it("clears a set alarm when the schedule is cleared", () => {
    setTasks([{ ...savedTask, alarmTime: "07:15" }]);
    const screen = render(<EditTaskScreen />);

    expect(screen.getByTestId("edit-task-clear-alarm")).toBeTruthy();

    fireEvent.press(screen.getByTestId("edit-task-clear-schedule"));

    // No confirmation: nothing is written until ✓, and the Alarm row reverting
    // to "Add alarm" is the feedback.
    expect(screen.queryByTestId("edit-task-clear-alarm")).toBeNull();
    expect(screen.getByTestId("edit-task-add-alarm")).toBeTruthy();

    pressSave();

    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledFor: null, alarmTime: null }),
      expect.anything(),
    );
  });

  it("pulls an unscheduled task onto today when an alarm is added", async () => {
    setTasks([{ ...savedTask, scheduledFor: null }]);
    const screen = render(<EditTaskScreen />);

    fireEvent.press(screen.getByTestId("edit-task-add-alarm"));
    await screen.findByTestId("edit-task-clear-alarm");

    pressSave();

    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduledFor: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        alarmTime: expect.stringMatching(/^\d{2}:\d{2}$/),
      }),
      expect.anything(),
    );
  });

  // Provenance belongs to the row, not the form — writing the payload back
  // must leave `template_id` pointing where it already pointed.
  it("carries the task's template link through a save", () => {
    setTasks([{ ...savedTask, templateId: "template-1" }]);
    render(<EditTaskScreen />);

    pressSave();

    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "template-1" }),
      expect.anything(),
    );
  });

  // `goalId` and `status` have no control on this form, so they must stay out
  // of the payload rather than ride along as stale values.
  it("never writes fields the form does not own", () => {
    setTasks([
      { ...savedTask, goalId: "goal-1", status: ETaskStatus.IN_PROGRESS },
    ]);
    render(<EditTaskScreen />);

    pressSave();

    const [diff] = mockUpdateTask.mock.calls[0];
    expect(diff).not.toHaveProperty("goalId");
    expect(diff).not.toHaveProperty("status");
  });

  it("waits for the fetch rather than redirecting on a cold load", () => {
    setTasks([], true);
    render(<EditTaskScreen />);

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockNavigation.setOptions).not.toHaveBeenCalled();
  });

  it("redirects once the task is known to be gone", () => {
    setTasks([], false);
    render(<EditTaskScreen />);

    expect(mockRedirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: "/" }),
    );
  });
});
