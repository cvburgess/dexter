import { Temporal } from "@js-temporal/polyfill";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert, StyleSheet, TextStyle } from "react-native";
import type { ReactTestInstance } from "react-test-renderer";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { OpenTasksStep } from "@/components/OpenTasksStep";
import { useTasks } from "@/hooks/useTasks";
import { themes } from "@/utils/theme";

// useTasks imports the supabase client from useAuth, which reads the app's URI
// scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useTasks", () => ({
  ...jest.requireActual<typeof import("@/hooks/useTasks")>("@/hooks/useTasks"),
  useTasks: jest.fn(),
}));
jest.mock("@/hooks/useTemplates", () => ({
  useTemplates: jest.fn(() => [[], {}]),
}));

// The card has its own suite and carries several `@expo/ui` menu hosts that a
// unit test can't drive; standing it in as a marker keeps this file about the
// hero, the scope, and the two buttons beside it.
jest.mock("@/components/TaskCard", () => {
  const { Text: RNText } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    TaskCard: function MockTaskCard({ task }: { task: { title: string } }) {
      return <RNText>{`card:${task.title}`}</RNText>;
    },
  };
});

jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockUpdateTask = jest.fn();

const DATE = Temporal.PlainDate.from("2026-08-09");
const TOMORROW = "2026-08-10";

const task = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.UNPRIORITIZED,
  scheduledFor: DATE.toString(),
  status: ETaskStatus.TODO,
  subtasks: [],
  templateId: null,
  title: "Write report",
  url: null,
  ...overrides,
});

const tasksResult = (
  tasks: TTask[],
  isLoading = false,
): ReturnType<typeof useTasks> =>
  [
    tasks,
    {
      createTask: jest.fn(),
      deleteTask: jest.fn(),
      isError: false,
      isLoading,
      refetch: jest.fn(),
      updateTask: mockUpdateTask,
      updateTasks: jest.fn(),
    },
  ] as never;

const renderStep = (
  tasks: TTask[] = [],
  { isLoading = false, date = DATE } = {},
) => {
  mockUseTasks.mockReturnValue(tasksResult(tasks, isLoading));
  return render(<OpenTasksStep date={date} onEditingChange={jest.fn()} />);
};

/** The color a rendered `<Text>` resolves to, for the hero's ink assertions. */
const colorOf = (node: ReactTestInstance) =>
  StyleSheet.flatten(node.props.style as TextStyle).color;

// The palette `useTheme` falls back to outside a provider on a light scheme.
const { colors } = themes.dexter;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("OpenTasksStep", () => {
  // `useTasks` hands back an empty placeholder array until the query resolves,
  // so the day looks finished on every cold open — the all-clear here would
  // throw confetti at someone whose evening is full.
  it("renders nothing rather than a premature all-clear", () => {
    const screen = renderStep([], { isLoading: true });

    expect(screen.toJSON()).toBeNull();
  });

  describe("the day's open tasks", () => {
    it("counts them and lists them", () => {
      const screen = renderStep([
        task({ id: "1", title: "Write report" }),
        task({ id: "2", title: "Email the vendor" }),
      ]);

      expect(screen.getByLabelText("2 open tasks")).toBeTruthy();
      expect(screen.getByText("card:Write report")).toBeTruthy();
      expect(screen.getByText("card:Email the vendor")).toBeTruthy();
      expect(screen.queryByTestId("open-tasks-step-clear")).toBeNull();
    });

    it("says 'task' for one and 'tasks' for the rest", () => {
      const screen = renderStep([task({ id: "1" })]);

      expect(screen.getByLabelText("1 open task")).toBeTruthy();
    });

    // The scope is the ritual's own day and only what is still open: a
    // completed task is not something to close out, and another day's is the
    // morning Backlog step's business.
    it("leaves out closed tasks and other days", () => {
      const screen = renderStep([
        task({ id: "1", title: "Still open" }),
        task({ id: "2", title: "Finished", status: ETaskStatus.DONE }),
        task({ id: "3", title: "Handed off", status: ETaskStatus.DELEGATED }),
        task({ id: "4", title: "Tomorrow's", scheduledFor: TOMORROW }),
        task({ id: "5", title: "Unscheduled", scheduledFor: null }),
      ]);

      expect(screen.getByLabelText("1 open task")).toBeTruthy();
      expect(screen.getByText("card:Still open")).toBeTruthy();
      expect(screen.queryByText("card:Finished")).toBeNull();
      expect(screen.queryByText("card:Tomorrow's")).toBeNull();
    });
  });

  describe("with the day closed out", () => {
    it("centers the count and celebrates", () => {
      const screen = renderStep([]);

      expect(screen.getByTestId("open-tasks-step-clear")).toBeTruthy();
      expect(screen.getByTestId("confetti")).toBeTruthy();
      expect(screen.getByLabelText("0 open tasks")).toBeTruthy();
      expect(colorOf(screen.getByTestId("hero-figure-open"))).toBe(
        colors.success,
      );
    });

    // The confetti is the all-clear's, not the step's: a cold cache reaches the
    // `isLoading` guard first, and a day with work left has nothing to celebrate.
    it("does not celebrate a day with work left in it", () => {
      const screen = renderStep([task()]);

      expect(screen.queryByTestId("confetti")).toBeNull();
      expect(colorOf(screen.getByTestId("hero-figure-open"))).toBe(
        colors.primary,
      );
    });

    it("does not celebrate a cold cache", () => {
      const screen = renderStep([], { isLoading: true });

      expect(screen.queryByTestId("confetti")).toBeNull();
    });
  });

  describe("the quick actions", () => {
    it("moves a task to the day after the one being closed out", () => {
      const screen = renderStep([task()]);

      fireEvent.press(
        screen.getByLabelText('Move "Write report" to Monday, Aug 10'),
      );

      expect(mockUpdateTask).toHaveBeenCalledWith({
        id: "task-1",
        scheduledFor: TOMORROW,
      });
    });

    // The ritual can be paged to any date with `DayNav`, so "tomorrow" is the
    // day after the *ritual's* — an implementation anchored to `Temporal.Now`
    // would send this task to the wrong day and pass every test above.
    it("follows the ritual's date rather than the real tomorrow", () => {
      const screen = renderStep([task({ scheduledFor: "2026-01-02" })], {
        date: Temporal.PlainDate.from("2026-01-02"),
      });

      fireEvent.press(
        screen.getByLabelText('Move "Write report" to Saturday, Jan 3'),
      );

      expect(mockUpdateTask).toHaveBeenCalledWith({
        id: "task-1",
        scheduledFor: "2026-01-03",
      });
    });

    it("unschedules a task off the day", () => {
      const screen = renderStep([task()]);

      fireEvent.press(screen.getByLabelText('Unschedule "Write report"'));

      expect(mockUpdateTask).toHaveBeenCalledWith({
        id: "task-1",
        scheduledFor: null,
      });
    });
  });

  // Both buttons write `scheduledFor`, so both owe the alarm prompt the card's
  // own menu gives (DEX-77). Writing straight through is exactly what left a
  // backlog task's alarm pointing at the day it came from.
  describe("a task carrying an alarm", () => {
    // The native ConfirmationModal renders nothing and calls `Alert.alert`
    // imperatively, so the prompt is asserted through the spy rather than by
    // querying for text. Restored in `afterEach` — a spy left in place leaks
    // into every later test in the run.
    let alertSpy: jest.SpyInstance;

    const pressAndReadPrompt = (label: string) => {
      alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
      const screen = renderStep([task({ alarmTime: "09:00:00" })]);
      fireEvent.press(screen.getByLabelText(label));
      const [title, , buttons] = alertSpy.mock.calls[0] as [
        string,
        string,
        { text: string; onPress?: () => void }[],
      ];
      return { title, buttons };
    };

    afterEach(() => alertSpy?.mockRestore());

    it("asks before moving it to tomorrow", () => {
      const { title } = pressAndReadPrompt(
        'Move "Write report" to Monday, Aug 10',
      );

      expect(title).toBe("Reschedule task?");
      expect(mockUpdateTask).not.toHaveBeenCalled();
    });

    it("carries the alarm over once the move is confirmed", () => {
      const { buttons } = pressAndReadPrompt(
        'Move "Write report" to Monday, Aug 10',
      );
      const keep = buttons.find((button) => button.text === "Keep alarm");

      act(() => keep?.onPress?.());

      expect(mockUpdateTask).toHaveBeenCalledWith({
        id: "task-1",
        scheduledFor: TOMORROW,
      });
    });

    // Unscheduling removes the date the alarm needs to fire, so it is
    // unset-or-cancel rather than the keep-or-drop choice a move offers.
    // `await`ed, unlike the move above: this prompt resolves the `confirm`
    // promise and writes on the way back out of it, where each of the move's
    // buttons applies itself from its own `onPress`.
    it("warns that unscheduling unsets the alarm, then clears both", async () => {
      const { title, buttons } = pressAndReadPrompt(
        'Unschedule "Write report"',
      );
      expect(title).toBe("Unschedule task?");
      expect(mockUpdateTask).not.toHaveBeenCalled();

      await act(async () => {
        buttons.find((b) => b.text === "Unschedule")?.onPress?.();
        // The button itself returns void — the write lands a microtask later,
        // when the `confirm` promise the hook is awaiting resolves.
        await Promise.resolve();
      });

      expect(mockUpdateTask).toHaveBeenCalledWith({
        id: "task-1",
        scheduledFor: null,
        alarmTime: null,
      });
    });
  });
});
