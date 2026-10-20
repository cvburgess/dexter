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

// Repeat tasks and task templates share one table; only the scheduleless rows
// should reach the Template tab.
const packingTemplate = {
  id: "template-packing",
  alarmTime: null,
  createdAt: "2026-01-01T00:00:00Z",
  goalId: null,
  listId: "list-home",
  priority: ETaskPriority.IMPORTANT,
  schedule: null,
  subtasks: [{ id: "sub-1", title: "Passport" }],
  title: "Trip packing",
  userId: "user-1",
};
const standupTemplate = {
  ...packingTemplate,
  id: "template-standup",
  schedule: "0 0 * * 1",
  subtasks: [],
  title: "Weekly standup",
};
const templatesState: { current: unknown[] } = { current: [] };
jest.mock("@/hooks/useTemplates", () => ({
  useTemplates: () => [
    templatesState.current,
    {
      createTemplate: jest.fn(),
      deleteTemplate: jest.fn(),
      getTemplateById: () => undefined,
      isLoading: false,
      updateTemplate: jest.fn(),
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
// Holds the route params NewTaskButton passes (e.g. the viewed day); reset per test.
const mockSearchParams: { current: Record<string, string> } = { current: {} };
jest.mock("expo-router", () => ({
  useNavigation: () => mockNavigation,
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockSearchParams.current,
}));

// The header buttons are wired via navigation.setOptions on every render;
// grab the latest options to interact with them like the header would.
const headerOptions = () => mockNavigation.setOptions.mock.calls.at(-1)?.[0];

// @expo/ui form controls are mocked globally in jest.setup.js; control state
// logic is covered by the useTaskForm hook tests.

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockCreateTask = jest.fn();

describe("NewTaskScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.canDismiss.mockReturnValue(true);
    listsState.isLoading = false;
    mockSearchParams.current = {};
    templatesState.current = [];
    mockCreateTask.mockImplementation((_task, callbacks) => {
      callbacks?.onSuccess?.();
    });
    mockUseTasks.mockReturnValue([
      [],
      {
        createTask: mockCreateTask,
        deleteTask: jest.fn(),
        isError: false,
        isLoading: false,
        refetch: jest.fn(),
        updateTask: jest.fn(),
        updateTasks: jest.fn(),
      },
    ]);
  });

  it("disables the header save button while the title is empty", async () => {
    await render(<NewTaskScreen />);

    const save = await render(headerOptions().headerRight());
    await fireEvent.press(save.getByTestId("modal-done-button"));

    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(headerOptions().unstable_headerRightItems()[0].disabled).toBe(true);
  });

  it("cancels from the header close button without creating a task", async () => {
    await render(<NewTaskScreen />);

    const close = await render(headerOptions().headerLeft());
    await fireEvent.press(close.getByTestId("modal-close-button"));

    expect(mockRouter.back).toHaveBeenCalled();
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  // A cold deep link leaves the stack holding only this modal, where `back()`
  // is an unhandled GO_BACK: ✕ looks dead and ✓ never closes.
  it("replaces rather than popping when there is nothing beneath it", async () => {
    mockRouter.canDismiss.mockReturnValue(false);
    await render(<NewTaskScreen />);

    const close = await render(headerOptions().headerLeft());
    await fireEvent.press(close.getByTestId("modal-close-button"));

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
  });

  it("creates a task from the parsed title and dismisses the modal", async () => {
    const today = Temporal.Now.plainDateISO();
    const screen = await render(<NewTaskScreen />);

    await fireEvent.changeText(
      screen.getByTestId("new-task-title"),
      "!! Write the spec #home due:2",
    );
    const save = await render(headerOptions().headerRight());
    await fireEvent.press(save.getByTestId("modal-done-button"));

    expect(mockCreateTask).toHaveBeenCalledWith(
      {
        title: "Write the spec",
        priority: ETaskPriority.IMPORTANT,
        listId: "list-home",
        scheduledFor: today.toString(),
        dueOn: today.add({ days: 2 }).toString(),
        alarmTime: null,
        url: null,
        // Nothing seeded this form, so there is no provenance to record.
        templateId: null,
        subtasks: [],
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("schedules the task for the viewed day passed as a route param", async () => {
    mockSearchParams.current = { scheduledFor: "2026-07-08" };
    const screen = await render(<NewTaskScreen />);

    await fireEvent.changeText(
      screen.getByTestId("new-task-title"),
      "Plan the week",
    );
    const save = await render(headerOptions().headerRight());
    await fireEvent.press(save.getByTestId("modal-done-button"));

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Plan the week",
        scheduledFor: "2026-07-08",
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  // The deadline row starts empty, so "Add deadline" is what picks its date —
  // and it has to pick the viewed day, not today (DEX-165).
  it("deadlines the task to the viewed day, not today", async () => {
    mockSearchParams.current = { scheduledFor: "2026-07-08" };
    const screen = await render(<NewTaskScreen />);

    await fireEvent.changeText(
      screen.getByTestId("new-task-title"),
      "Plan the week",
    );
    await fireEvent.press(screen.getByTestId("new-task-add-deadline"));
    const save = await render(headerOptions().headerRight());
    await fireEvent.press(save.getByTestId("modal-done-button"));

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ dueOn: "2026-07-08" }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  // How a shared link reaches the form: `ShareIntentRedirect` pushes this
  // route with the link as a param (DEX-66).
  it("pre-fills the link passed as a route param", async () => {
    mockSearchParams.current = { url: "https://example.com/article" };
    const screen = await render(<NewTaskScreen />);

    expect(screen.getByTestId("new-task-url").props.value).toBe(
      "https://example.com/article",
    );

    await fireEvent.changeText(
      screen.getByTestId("new-task-title"),
      "Read this",
    );
    const save = await render(headerOptions().headerRight());
    await fireEvent.press(save.getByTestId("modal-done-button"));

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Read this",
        url: "https://example.com/article",
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("completes a typed bare host to an openable link", async () => {
    const screen = await render(<NewTaskScreen />);

    await fireEvent.changeText(
      screen.getByTestId("new-task-title"),
      "Read the docs",
    );
    await fireEvent.changeText(
      screen.getByTestId("new-task-url"),
      "dexterplanner.com",
    );
    const save = await render(headerOptions().headerRight());
    await fireEvent.press(save.getByTestId("modal-done-button"));

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://dexterplanner.com" }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("saves a manually selected priority over a typed token", async () => {
    const screen = await render(<NewTaskScreen />);

    await fireEvent.changeText(
      screen.getByTestId("new-task-title"),
      "! Pay bills",
    );
    await fireEvent.press(screen.getByLabelText("Important"));
    const save = await render(headerOptions().headerRight());
    await fireEvent.press(save.getByTestId("modal-done-button"));

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Pay bills",
        priority: ETaskPriority.IMPORTANT,
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("keeps the modal open and allows retrying when the save fails", async () => {
    mockCreateTask.mockImplementation((_task, callbacks) => {
      callbacks?.onError?.(new Error("network error"));
    });
    const screen = await render(<NewTaskScreen />);

    await fireEvent.changeText(
      screen.getByTestId("new-task-title"),
      "Pay bills",
    );
    const save = await render(headerOptions().headerRight());
    await fireEvent.press(save.getByTestId("modal-done-button"));

    expect(mockCreateTask).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).not.toHaveBeenCalled();

    await fireEvent.press(save.getByTestId("modal-done-button"));
    expect(mockCreateTask).toHaveBeenCalledTimes(2);
  });

  it("only creates one task when save is pressed twice", async () => {
    const screen = await render(<NewTaskScreen />);

    await fireEvent.changeText(
      screen.getByTestId("new-task-title"),
      "Pay bills",
    );
    const save = await render(headerOptions().headerRight());
    await fireEvent.press(save.getByTestId("modal-done-button"));
    await fireEvent.press(save.getByTestId("modal-done-button"));
    await fireEvent(screen.getByTestId("new-task-title"), "submitEditing");

    expect(mockCreateTask).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it("does not save while lists are still loading", async () => {
    listsState.isLoading = true;
    const screen = await render(<NewTaskScreen />);

    await fireEvent.changeText(
      screen.getByTestId("new-task-title"),
      "Pay #home",
    );
    const save = await render(headerOptions().headerRight());
    await fireEvent.press(save.getByTestId("modal-done-button"));

    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(headerOptions().unstable_headerRightItems()[0].disabled).toBe(true);
  });

  it("saves when the title input is submitted from the keyboard", async () => {
    const screen = await render(<NewTaskScreen />);

    await fireEvent.changeText(
      screen.getByTestId("new-task-title"),
      "Pay bills",
    );
    await fireEvent(screen.getByTestId("new-task-title"), "submitEditing");

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Pay bills" }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("skips query fetching for the task list", async () => {
    await render(<NewTaskScreen />);

    expect(mockUseTasks).toHaveBeenCalledWith({ skipQuery: true });
  });

  it("adds an alarm (seeded to the default time) to the created task", async () => {
    const screen = await render(<NewTaskScreen />);

    await fireEvent.changeText(screen.getByTestId("new-task-title"), "Wake up");
    // Enabling the alarm awaits AlarmKit authorization (granted in the mock),
    // then swaps the "Add alarm" affordance for the time + Clear controls.
    await fireEvent.press(screen.getByTestId("new-task-add-alarm"));
    await screen.findByTestId("new-task-clear-alarm");

    const save = await render(headerOptions().headerRight());
    await fireEvent.press(save.getByTestId("modal-done-button"));

    // Seeded to a "now"-based default (a few minutes out) rather than a fixed
    // time, so assert the shape rather than an exact value.
    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Wake up",
        alarmTime: expect.stringMatching(/^\d{2}:\d{2}$/),
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("creates an unscheduled task when the schedule is cleared", async () => {
    const screen = await render(<NewTaskScreen />);

    await fireEvent.changeText(screen.getByTestId("new-task-title"), "Someday");
    await fireEvent.press(screen.getByTestId("new-task-clear-schedule"));
    const save = await render(headerOptions().headerRight());
    await fireEvent.press(save.getByTestId("modal-done-button"));

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Someday", scheduledFor: null }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  // An alarm fires on the scheduled day, so the two can't disagree.
  it("drops a set alarm when the schedule is cleared", async () => {
    const screen = await render(<NewTaskScreen />);

    await fireEvent.changeText(screen.getByTestId("new-task-title"), "Someday");
    await fireEvent.press(screen.getByTestId("new-task-add-alarm"));
    await screen.findByTestId("new-task-clear-alarm");

    await fireEvent.press(screen.getByTestId("new-task-clear-schedule"));

    expect(screen.queryByTestId("new-task-clear-alarm")).toBeNull();
    expect(screen.getByTestId("new-task-add-alarm")).toBeTruthy();
  });

  it("pulls an unscheduled task onto today when an alarm is added", async () => {
    const today = Temporal.Now.plainDateISO();
    const screen = await render(<NewTaskScreen />);

    await fireEvent.changeText(screen.getByTestId("new-task-title"), "Wake up");
    await fireEvent.press(screen.getByTestId("new-task-clear-schedule"));
    await fireEvent.press(screen.getByTestId("new-task-add-alarm"));
    await screen.findByTestId("new-task-clear-alarm");

    const save = await render(headerOptions().headerRight());
    await fireEvent.press(save.getByTestId("modal-done-button"));

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Wake up",
        scheduledFor: today.toString(),
        alarmTime: expect.stringMatching(/^\d{2}:\d{2}$/),
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("restores today when the schedule is added back", async () => {
    const today = Temporal.Now.plainDateISO();
    const screen = await render(<NewTaskScreen />);

    await fireEvent.changeText(
      screen.getByTestId("new-task-title"),
      "Pay bills",
    );
    await fireEvent.press(screen.getByTestId("new-task-clear-schedule"));
    await fireEvent.press(screen.getByTestId("new-task-add-schedule"));
    const save = await render(headerOptions().headerRight());
    await fireEvent.press(save.getByTestId("modal-done-button"));

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledFor: today.toString() }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  // Clearing the schedule keeps the day the form opened on, so adding it back
  // returns to the viewed day rather than snapping to today (DEX-165).
  it("restores the viewed day when the schedule is added back", async () => {
    mockSearchParams.current = { scheduledFor: "2026-07-08" };
    const screen = await render(<NewTaskScreen />);

    await fireEvent.changeText(
      screen.getByTestId("new-task-title"),
      "Pay bills",
    );
    await fireEvent.press(screen.getByTestId("new-task-clear-schedule"));
    await fireEvent.press(screen.getByTestId("new-task-add-schedule"));
    const save = await render(headerOptions().headerRight());
    await fireEvent.press(save.getByTestId("modal-done-button"));

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledFor: "2026-07-08" }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  describe("modes", () => {
    it("starts on New, showing the form and no template list", async () => {
      templatesState.current = [packingTemplate];
      const screen = await render(<NewTaskScreen />);

      expect(screen.getByTestId("new-task-title")).toBeTruthy();
      expect(screen.queryByTestId("template-option-template-packing")).toBe(
        null,
      );
    });

    // A repeat task is a row in the same table, but it is a schedule, not a
    // blueprint — offering it here would create a task that silently recurs.
    it("lists only scheduleless templates in Template mode", async () => {
      templatesState.current = [packingTemplate, standupTemplate];
      const screen = await render(<NewTaskScreen />);

      await fireEvent.press(screen.getByTestId("new-task-mode-template"));

      expect(
        screen.getByTestId("template-option-template-packing"),
      ).toBeTruthy();
      expect(screen.queryByTestId("template-option-template-standup")).toBe(
        null,
      );
    });

    it("explains how to make one when there are no templates yet", async () => {
      templatesState.current = [standupTemplate];
      const screen = await render(<NewTaskScreen />);

      await fireEvent.press(screen.getByTestId("new-task-mode-template"));

      expect(screen.getByTestId("template-picker-empty")).toBeTruthy();
    });

    // Selecting seeds the form rather than saving, so the form stays visible
    // and everything it filled in is still editable.
    it("marks the chosen template selected and fills the form from it", async () => {
      templatesState.current = [packingTemplate];
      const screen = await render(<NewTaskScreen />);

      await fireEvent.press(screen.getByTestId("new-task-mode-template"));
      await fireEvent.press(
        screen.getByTestId("template-option-template-packing"),
      );

      expect(
        screen.getByTestId("template-option-template-packing").props
          .accessibilityState,
      ).toMatchObject({ selected: true });
      expect(screen.getByTestId("new-task-title").props.value).toBe(
        "Trip packing",
      );
    });

    it("creates a plain task from the selected template, checklist and all", async () => {
      const today = Temporal.Now.plainDateISO();
      templatesState.current = [packingTemplate];
      const screen = await render(<NewTaskScreen />);

      await fireEvent.press(screen.getByTestId("new-task-mode-template"));
      await fireEvent.press(
        screen.getByTestId("template-option-template-packing"),
      );
      const save = await render(headerOptions().headerRight());
      await fireEvent.press(save.getByTestId("modal-done-button"));

      expect(mockCreateTask).toHaveBeenCalledWith(
        {
          title: "Trip packing",
          priority: ETaskPriority.IMPORTANT,
          listId: "list-home",
          // The template carries no dates; the task still lands on the day the
          // user was viewing.
          scheduledFor: today.toString(),
          dueOn: null,
          alarmTime: null,
          // A template has no link of its own to stamp onto the task.
          url: null,
          // Where it came from, recorded. Nothing recurs from it — the picker
          // only offers scheduleless rows.
          templateId: "template-packing",
          // Fresh ids, so two tasks from one template never collide.
          subtasks: [
            { id: expect.any(String), title: "Passport", done: false },
          ],
        },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });

    it("shows the AI placeholder and refuses to save from it", async () => {
      const screen = await render(<NewTaskScreen />);

      await fireEvent.changeText(
        screen.getByTestId("new-task-title"),
        "Pay bills",
      );
      await fireEvent.press(screen.getByTestId("new-task-mode-ai"));

      expect(screen.getByTestId("new-task-ai-placeholder")).toBeTruthy();
      expect(screen.queryByTestId("new-task-title")).toBe(null);

      const save = await render(headerOptions().headerRight());
      await fireEvent.press(save.getByTestId("modal-done-button"));

      expect(mockCreateTask).not.toHaveBeenCalled();
      expect(headerOptions().unstable_headerRightItems()[0].disabled).toBe(
        true,
      );
    });
  });
});
