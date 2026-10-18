import { Temporal } from "@js-temporal/polyfill";
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

// `useDismissModal` guards on `canDismiss`, not `canGoBack` (also true for a
// tab jump). Default to "something beneath us" — every in-app entry.
const mockRouter = {
  back: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  canDismiss: jest.fn(() => true),
};
const mockNavigation = { setOptions: jest.fn() };
const mockSearchParams: { current: Record<string, string> } = { current: {} };
// Stands in for react-navigation's focus lifecycle; `mockIsFocused` lets a
// test hold the screen in the background.
const mockIsFocused = { current: true };
jest.mock("expo-router", () => {
  const { useEffect } = require("react");
  return {
    useNavigation: () => mockNavigation,
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockSearchParams.current,
    useFocusEffect: (effect: () => void | (() => void)) => {
      useEffect(() => {
        if (!mockIsFocused.current) return;
        return effect();
      }, [effect]);
    },
  };
});

// jest.setup renders the SwiftUI DatePicker as null, hiding TimeField.ios's
// lower bound — capture props by testID (DateField uses the same primitive).
const datePickerProps: Record<string, { range?: { start: Date } }> = {};
jest.mock("@expo/ui/swift-ui", () => ({
  DatePicker: (props: { testID?: string; range?: { start: Date } }) => {
    if (props.testID) datePickerProps[props.testID] = props;
    return null;
  },
  Host: ({ children }: { children: React.ReactNode }) => children,
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
  url: null,
};

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockUpdateTask = jest.fn();
const mockRefetch = jest.fn();

/** Points the mocked hook at a task list and a query state. */
const setTasks = (
  tasks: TTask[],
  { isError = false, isLoading = false } = {},
) =>
  mockUseTasks.mockReturnValue([
    tasks,
    {
      createTask: jest.fn(),
      deleteTask: jest.fn(),
      isError,
      isLoading,
      refetch: mockRefetch,
      updateTask: mockUpdateTask,
      updateTasks: jest.fn(),
    },
  ]);

describe("EditTaskScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.canDismiss.mockReturnValue(true);
    mockIsFocused.current = true;
    mockSearchParams.current = { id: "task-1" };
    mockUpdateTask.mockImplementation((_diff, callbacks) => {
      callbacks?.onSuccess?.();
    });
    setTasks([savedTask]);
  });

  it("seeds the form from the saved task", async () => {
    const screen = await render(<EditTaskScreen />);

    expect(screen.getByTestId("edit-task-title").props.value).toBe(
      "Write the report",
    );
  });

  // The create modal autofocuses because the title is empty; here the form
  // opens filled, and raising the keyboard would cover the fields below it.
  it("does not autofocus the title", async () => {
    const screen = await render(<EditTaskScreen />);

    expect(screen.getByTestId("edit-task-title").props.autoFocus).toBeFalsy();
  });

  it("saves the whole field set against the task's id and dismisses", async () => {
    const screen = await render(<EditTaskScreen />);

    await fireEvent.changeText(
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
        url: null,
        templateId: null,
        subtasks: [],
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(mockRouter.back).toHaveBeenCalled();
  });

  // Shorthand is create-only: a saved title is text the user already committed
  // to, not input waiting to be parsed (DEX-98).
  it("keeps shorthand characters in the title instead of parsing them", async () => {
    setTasks([{ ...savedTask, title: "Ship it!! #home due:3" }]);
    const screen = await render(<EditTaskScreen />);

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

  it("seeds the link from the saved task and writes an edit back", async () => {
    setTasks([{ ...savedTask, url: "https://example.com/old" }]);
    const screen = await render(<EditTaskScreen />);

    expect(screen.getByTestId("edit-task-url").props.value).toBe(
      "https://example.com/old",
    );

    await fireEvent.changeText(
      screen.getByTestId("edit-task-url"),
      "https://example.com/new",
    );
    pressSave();

    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://example.com/new" }),
      expect.anything(),
    );
  });

  // Clearing the field removes the link rather than storing an empty one.
  it("clears a saved link back to null", async () => {
    setTasks([{ ...savedTask, url: "https://example.com/old" }]);
    const screen = await render(<EditTaskScreen />);

    await fireEvent.changeText(screen.getByTestId("edit-task-url"), "");
    pressSave();

    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({ url: null }),
      expect.anything(),
    );
  });

  it("disables save while the title is empty", async () => {
    const screen = await render(<EditTaskScreen />);

    await fireEvent.changeText(screen.getByTestId("edit-task-title"), "   ");
    pressSave();

    expect(mockUpdateTask).not.toHaveBeenCalled();
    expect(headerOptions().unstable_headerRightItems()[0].disabled).toBe(true);
  });

  it("cancels from the header close button without writing", async () => {
    await render(<EditTaskScreen />);

    const close = await render(headerOptions().headerLeft());
    await fireEvent.press(close.getByTestId("modal-close-button"));

    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it("only writes once when save is pressed twice", async () => {
    const screen = await render(<EditTaskScreen />);

    const save = await render(headerOptions().headerRight());
    await fireEvent.press(save.getByTestId("modal-done-button"));
    await fireEvent.press(save.getByTestId("modal-done-button"));
    await fireEvent(screen.getByTestId("edit-task-title"), "submitEditing");

    expect(mockUpdateTask).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  // The write is optimistic, so a failure rolls the cache back — closing over
  // it would lose the user's edits with nothing to show for them.
  it("stays open and allows retrying when the save fails", async () => {
    mockUpdateTask.mockImplementation((_diff, callbacks) => {
      callbacks?.onError?.(new Error("network error"));
    });
    const screen = await render(<EditTaskScreen />);

    await fireEvent.changeText(
      screen.getByTestId("edit-task-title"),
      "Renamed",
    );
    const save = await render(headerOptions().headerRight());
    await fireEvent.press(save.getByTestId("modal-done-button"));

    expect(mockUpdateTask).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).not.toHaveBeenCalled();

    await fireEvent.press(save.getByTestId("modal-done-button"));
    expect(mockUpdateTask).toHaveBeenCalledTimes(2);
  });

  it("saves when the title input is submitted from the keyboard", async () => {
    const screen = await render(<EditTaskScreen />);

    await fireEvent.changeText(
      screen.getByTestId("edit-task-title"),
      "Renamed",
    );
    await fireEvent(screen.getByTestId("edit-task-title"), "submitEditing");

    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: "task-1", title: "Renamed" }),
      expect.anything(),
    );
  });

  it("clears a set alarm when the schedule is cleared", async () => {
    setTasks([{ ...savedTask, alarmTime: "07:15" }]);
    const screen = await render(<EditTaskScreen />);

    expect(screen.getByTestId("edit-task-clear-alarm")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("edit-task-clear-schedule"));

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

  // Edit-only: a saved alarm can be in the past, and a range excluding it
  // makes SwiftUI silently clamp and persist it on ✓.
  describe("alarm picker bounds (clock pinned to midday)", () => {
    beforeEach(() => jest.useFakeTimers({ now: new Date(2026, 6, 29, 12, 0) }));
    afterEach(() => jest.useRealTimers());

    const scheduledToday = (alarmTime: string) => {
      setTasks([
        {
          ...savedTask,
          scheduledFor: Temporal.Now.plainDateISO().toString(),
          alarmTime,
        },
      ]);
      render(<EditTaskScreen />);
      return datePickerProps["edit-task-alarm"]?.range;
    };

    it("does not bound the picker below an alarm already in the past", () => {
      expect(scheduledToday("08:00")).toBeUndefined();
    });

    it("still bounds the picker to now for an alarm later today", () => {
      expect(scheduledToday("23:59")).toBeDefined();
    });
  });

  it("pulls an unscheduled task onto today when an alarm is added", async () => {
    setTasks([{ ...savedTask, scheduledFor: null }]);
    const screen = await render(<EditTaskScreen />);

    await fireEvent.press(screen.getByTestId("edit-task-add-alarm"));
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
  it("carries the task's template link through a save", async () => {
    setTasks([{ ...savedTask, templateId: "template-1" }]);
    await render(<EditTaskScreen />);

    pressSave();

    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "template-1" }),
      expect.anything(),
    );
  });

  // `goalId` and `status` have no control on this form, so they must stay out
  // of the payload rather than ride along as stale values.
  it("never writes fields the form does not own", async () => {
    setTasks([
      { ...savedTask, goalId: "goal-1", status: ETaskStatus.IN_PROGRESS },
    ]);
    await render(<EditTaskScreen />);

    pressSave();

    const [diff] = mockUpdateTask.mock.calls[0];
    expect(diff).not.toHaveProperty("goalId");
    expect(diff).not.toHaveProperty("status");
  });

  // A cold deep link leaves the stack holding only this modal, where `back()`
  // is an unhandled GO_BACK: ✕ looks dead and ✓ never closes.
  it("replaces rather than popping when there is nothing beneath it", async () => {
    mockRouter.canDismiss.mockReturnValue(false);
    await render(<EditTaskScreen />);

    const close = await render(headerOptions().headerLeft());
    await fireEvent.press(close.getByTestId("modal-close-button"));

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
  });

  it("closes after a save reached from a cold deep link", async () => {
    mockRouter.canDismiss.mockReturnValue(false);
    await render(<EditTaskScreen />);

    pressSave();

    expect(mockUpdateTask).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
  });

  it("waits for the fetch rather than dismissing on a cold load", async () => {
    setTasks([], { isLoading: true });
    await render(<EditTaskScreen />);

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  // The form owns the only header on web and doesn't render until the task
  // resolves — before DEX-101 a cold deep link was a bare spinner.
  describe("while the task is still loading", () => {
    beforeEach(() => setTasks([], { isLoading: true }));

    it("still offers a working close button", async () => {
      await render(<EditTaskScreen />);

      const close = await render(headerOptions().headerLeft());
      await fireEvent.press(close.getByTestId("modal-close-button"));

      expect(mockRouter.back).toHaveBeenCalledTimes(1);
      expect(mockUpdateTask).not.toHaveBeenCalled();
    });

    // The case the guard exists for: closing before the fetch lands has to
    // behave the same as closing after it.
    it("replaces rather than popping on a cold deep link", async () => {
      mockRouter.canDismiss.mockReturnValue(false);
      await render(<EditTaskScreen />);

      headerOptions().unstable_headerLeftItems()[0].onPress();

      expect(mockRouter.back).not.toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith("/");
    });

    // The resolved form re-wires the header on mount, so the disabled ✓ from
    // the loading state must not survive the swap.
    it("hands the header over to the form once the task lands", async () => {
      const screen = await render(<EditTaskScreen />);
      expect(headerOptions().unstable_headerRightItems()[0].disabled).toBe(
        true,
      );

      setTasks([savedTask]);
      await await screen.rerender(<EditTaskScreen />);

      expect(headerOptions().unstable_headerRightItems()[0].disabled).toBe(
        false,
      );
      expect(screen.getByTestId("edit-task-title").props.value).toBe(
        "Write the report",
      );
    });
  });

  // Closes the modal rather than navigating the app, so the screen it was
  // opened over is still there (DEX-100).
  it("dismisses the modal once the task is known to be gone", async () => {
    setTasks([]);
    await render(<EditTaskScreen />);

    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("only dismisses once when the absent state re-renders", async () => {
    setTasks([]);
    const screen = await render(<EditTaskScreen />);

    await await screen.rerender(<EditTaskScreen />);

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it("replaces to the root when a deleted task was deep-linked cold", async () => {
    mockRouter.canDismiss.mockReturnValue(false);
    setTasks([]);
    await render(<EditTaskScreen />);

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
  });

  // `back()` pops whichever navigator is focused, so a background-tab refetch
  // that drops the task must not pop the screen the user is looking at.
  it("waits for focus before dismissing a backgrounded screen", async () => {
    mockIsFocused.current = false;
    setTasks([]);
    await render(<EditTaskScreen />);

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  // `isLoading` drops to false on error while `tasks` falls back to `[]`, so
  // without `isError` a failed fetch looks like a deleted task (DEX-100).
  describe("when the tasks query fails", () => {
    beforeEach(() => setTasks([], { isError: true }));

    it("reports the failure instead of dismissing", async () => {
      const screen = await render(<EditTaskScreen />);

      expect(
        screen.getByText(
          "Couldn't load your tasks. Check your connection and try again.",
        ),
      ).toBeTruthy();
      expect(mockRouter.back).not.toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it("retries the fetch and shows the form once it succeeds", async () => {
      const screen = await render(<EditTaskScreen />);

      await fireEvent.press(screen.getByTestId("modal-error-retry"));
      expect(mockRefetch).toHaveBeenCalledTimes(1);

      setTasks([savedTask]);
      await await screen.rerender(<EditTaskScreen />);

      expect(screen.getByTestId("edit-task-title").props.value).toBe(
        "Write the report",
      );
    });

    it("closes from the header without a live save action", async () => {
      await render(<EditTaskScreen />);

      const close = await render(headerOptions().headerLeft());
      await fireEvent.press(close.getByTestId("modal-close-button"));

      expect(mockRouter.back).toHaveBeenCalled();
      expect(headerOptions().unstable_headerRightItems()[0].disabled).toBe(
        true,
      );
    });
  });

  // A background refetch can fail after first load; the cache still holds the
  // task, so the form being typed into must survive it.
  it("keeps the form mounted when a refetch fails after the task resolved", async () => {
    setTasks([savedTask], { isError: true });
    const screen = await render(<EditTaskScreen />);

    expect(screen.getByTestId("edit-task-title").props.value).toBe(
      "Write the report",
    );
    expect(screen.queryByTestId("modal-error-retry")).toBeNull();
  });
});
