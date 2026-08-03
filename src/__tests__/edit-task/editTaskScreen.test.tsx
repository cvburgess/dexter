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

// `useDismissModal` guards on `canDismiss` — not the global `canGoBack`, which
// is also true when the only "back" available is a tab jump. Default to "there
// is something beneath us", which is every in-app entry into this modal.
const mockRouter = {
  back: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  canDismiss: jest.fn(() => true),
};
const mockNavigation = { setOptions: jest.fn() };
const mockSearchParams: { current: Record<string, string> } = { current: {} };
// Stands in for react-navigation's focus lifecycle: the effect runs while the
// screen is focused, which is the case for every in-app open of this modal.
// `mockIsFocused` lets a test hold the screen in the background instead.
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

// jest.setup renders `@expo/ui`'s SwiftUI DatePicker as null, which hides the
// lower bound `TimeField.ios` hands it. Capture the props instead so the alarm
// picker's range is assertable; keyed by testID, since `DateField.ios` renders
// through the very same primitive.
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

  it("seeds the link from the saved task and writes an edit back", () => {
    setTasks([{ ...savedTask, url: "https://example.com/old" }]);
    const screen = render(<EditTaskScreen />);

    expect(screen.getByTestId("edit-task-url").props.value).toBe(
      "https://example.com/old",
    );

    fireEvent.changeText(
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
  it("clears a saved link back to null", () => {
    setTasks([{ ...savedTask, url: "https://example.com/old" }]);
    const screen = render(<EditTaskScreen />);

    fireEvent.changeText(screen.getByTestId("edit-task-url"), "");
    pressSave();

    expect(mockUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({ url: null }),
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

  // The create form can only ever seed `defaultAlarmTime()` (now + a few
  // minutes), so this is edit-only: a saved 08:00 alarm on a task scheduled
  // today is in the past by lunchtime, and a range that excludes it makes
  // SwiftUI clamp the selection to now — silently moving an alarm the user
  // only came to look at, and persisting it on ✓.
  //
  // The clock is pinned because both cases are stated relative to "now": with a
  // real clock, a run just after midnight would leave a morning alarm in the
  // *future* and invert the first assertion.
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

  // A cold deep link to /edit-task/<id> leaves the stack holding only this
  // modal, where `back()` is an unhandled GO_BACK: ✕ looks dead and ✓ writes
  // without ever closing. Mirrors settings/tasks/[id]'s guard.
  it("replaces rather than popping when there is nothing beneath it", () => {
    mockRouter.canDismiss.mockReturnValue(false);
    render(<EditTaskScreen />);

    const close = render(headerOptions().headerLeft());
    fireEvent.press(close.getByTestId("modal-close-button"));

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
  });

  it("closes after a save reached from a cold deep link", () => {
    mockRouter.canDismiss.mockReturnValue(false);
    render(<EditTaskScreen />);

    pressSave();

    expect(mockUpdateTask).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
  });

  it("waits for the fetch rather than dismissing on a cold load", () => {
    setTasks([], { isLoading: true });
    render(<EditTaskScreen />);

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  // The form owns the only header on web, and it doesn't render until the task
  // resolves — so before DEX-101 a cold deep link was a bare spinner with no
  // way out but the backdrop.
  describe("while the task is still loading", () => {
    beforeEach(() => setTasks([], { isLoading: true }));

    it("still offers a working close button", () => {
      render(<EditTaskScreen />);

      const close = render(headerOptions().headerLeft());
      fireEvent.press(close.getByTestId("modal-close-button"));

      expect(mockRouter.back).toHaveBeenCalledTimes(1);
      expect(mockUpdateTask).not.toHaveBeenCalled();
    });

    // The case the guard exists for: closing before the fetch lands has to
    // behave the same as closing after it.
    it("replaces rather than popping on a cold deep link", () => {
      mockRouter.canDismiss.mockReturnValue(false);
      render(<EditTaskScreen />);

      headerOptions().unstable_headerLeftItems()[0].onPress();

      expect(mockRouter.back).not.toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith("/");
    });

    // The resolved form re-wires the header on mount, so the disabled ✓ from
    // the loading state must not survive the swap.
    it("hands the header over to the form once the task lands", () => {
      const screen = render(<EditTaskScreen />);
      expect(headerOptions().unstable_headerRightItems()[0].disabled).toBe(
        true,
      );

      setTasks([savedTask]);
      screen.rerender(<EditTaskScreen />);

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
  it("dismisses the modal once the task is known to be gone", () => {
    setTasks([]);
    render(<EditTaskScreen />);

    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("only dismisses once when the absent state re-renders", () => {
    setTasks([]);
    const screen = render(<EditTaskScreen />);

    screen.rerender(<EditTaskScreen />);

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it("replaces to the root when a deleted task was deep-linked cold", () => {
    mockRouter.canDismiss.mockReturnValue(false);
    setTasks([]);
    render(<EditTaskScreen />);

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
  });

  // `router.back()` pops whichever navigator is focused, and a modal screen
  // stays mounted while its tab is in the background — so a refetch that drops
  // the task there must not pop the screen the user is actually looking at.
  it("waits for focus before dismissing a backgrounded screen", () => {
    mockIsFocused.current = false;
    setTasks([]);
    render(<EditTaskScreen />);

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  // `isLoading` is `isPlaceholderData`, which react-query drops to `false` on
  // error while `tasks` falls back to `[]` — so without an explicit `isError`
  // a failed fetch is indistinguishable from a deleted task (DEX-100).
  describe("when the tasks query fails", () => {
    beforeEach(() => setTasks([], { isError: true }));

    it("reports the failure instead of dismissing", () => {
      const screen = render(<EditTaskScreen />);

      expect(
        screen.getByText(
          "Couldn't load your tasks. Check your connection and try again.",
        ),
      ).toBeTruthy();
      expect(mockRouter.back).not.toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it("retries the fetch and shows the form once it succeeds", () => {
      const screen = render(<EditTaskScreen />);

      fireEvent.press(screen.getByTestId("modal-error-retry"));
      expect(mockRefetch).toHaveBeenCalledTimes(1);

      setTasks([savedTask]);
      screen.rerender(<EditTaskScreen />);

      expect(screen.getByTestId("edit-task-title").props.value).toBe(
        "Write the report",
      );
    });

    it("closes from the header without a live save action", () => {
      render(<EditTaskScreen />);

      const close = render(headerOptions().headerLeft());
      fireEvent.press(close.getByTestId("modal-close-button"));

      expect(mockRouter.back).toHaveBeenCalled();
      expect(headerOptions().unstable_headerRightItems()[0].disabled).toBe(
        true,
      );
    });
  });

  // A background refetch can fail long after the first load resolved. The
  // cache still holds the task, so the form the user is typing into must
  // survive it rather than being replaced by the error state.
  it("keeps the form mounted when a refetch fails after the task resolved", () => {
    setTasks([savedTask], { isError: true });
    const screen = render(<EditTaskScreen />);

    expect(screen.getByTestId("edit-task-title").props.value).toBe(
      "Write the report",
    );
    expect(screen.queryByTestId("modal-error-retry")).toBeNull();
  });
});
