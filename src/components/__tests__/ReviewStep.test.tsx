import { Temporal } from "@js-temporal/polyfill";
import { render, screen } from "@testing-library/react-native";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import type { TFocusBlockStatus } from "@/utils/focusBlocks";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import type { TCalendarEvent } from "@/hooks/useCalendarEvents.types";
import { useFocusBlocks } from "@/hooks/useFocusBlocks";
import { useDailyHabits } from "@/hooks/useHabits";
import { usePreferences } from "@/hooks/usePreferences";
import { useTasks } from "@/hooks/useTasks";

import { ReviewStep } from "../ReviewStep";

// useTasks imports the supabase client from useAuth, which reads the app's URI
// scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useTasks", () => ({
  ...jest.requireActual<typeof import("@/hooks/useTasks")>("@/hooks/useTasks"),
  useTasks: jest.fn(),
}));
jest.mock("@/hooks/useHabits", () => ({
  ...jest.requireActual<typeof import("@/hooks/useHabits")>(
    "@/hooks/useHabits",
  ),
  useDailyHabits: jest.fn(),
}));
jest.mock("@/hooks/useCalendarEvents", () => ({
  useCalendarEvents: jest.fn(),
}));
jest.mock("@/hooks/useFocusBlocks", () => ({
  ...jest.requireActual<typeof import("@/hooks/useFocusBlocks")>(
    "@/hooks/useFocusBlocks",
  ),
  useFocusBlocks: jest.fn(),
}));
jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
// Reached only through `useTaskDelete`, which has its own suite — stubbed with
// real functions rather than `{}` so a delete added here fails on the assertion
// rather than on `getTemplateById is not a function`.
jest.mock("@/hooks/useTemplates", () => ({
  useTemplates: jest.fn(() => [
    [],
    { deleteTemplate: jest.fn(), getTemplateById: () => undefined },
  ]),
}));

// Both children have their own suites and carry several `@expo/ui` menu hosts a
// unit test can't drive; standing them in as markers keeps this file about the
// hero's figures and the step's scope.
jest.mock("@/components/TaskCard", () => {
  const { Text: RNText } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    TaskCard: function MockTaskCard({ task }: { task: { title: string } }) {
      return <RNText>{`card:${task.title}`}</RNText>;
    },
  };
});
jest.mock("@/components/HabitTracker", () => {
  const { Text: RNText } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    HabitTracker: function MockHabitTracker() {
      return <RNText>habit-tracker</RNText>;
    },
  };
});

jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockUseDailyHabits = useDailyHabits as jest.MockedFunction<
  typeof useDailyHabits
>;
const mockUseCalendarEvents = useCalendarEvents as jest.MockedFunction<
  typeof useCalendarEvents
>;
const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUseFocusBlocks = useFocusBlocks as jest.MockedFunction<
  typeof useFocusBlocks
>;

const DATE = Temporal.PlainDate.from("2026-08-09");
const OTHER_DAY = "2026-08-08";

const task = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.UNPRIORITIZED,
  scheduledFor: DATE.toString(),
  status: ETaskStatus.DONE,
  subtasks: [],
  templateId: null,
  title: "Write report",
  url: null,
  ...overrides,
});

const event = (id: string): TCalendarEvent =>
  ({ id, title: id, allDay: true }) as TCalendarEvent;

/** A daily habit row; `steps`/`stepsComplete` decide whether it counts. */
const dailyHabit = ({
  habitId = "habit-1",
  steps = 1,
  stepsComplete = 1,
  isPaused = false,
  isArchived = false,
} = {}) => ({
  habitId,
  steps,
  stepsComplete,
  habits: { isPaused, isArchived },
});

/** A focus block row; only `status` decides whether the hero counts it. */
const focusBlock = (status: TFocusBlockStatus, id: string = status) => ({
  id,
  status,
});

/** Seeds all four sources at once; every count defaults to empty. */
const setDay = ({
  habits = [] as ReturnType<typeof dailyHabit>[],
  events = [] as TCalendarEvent[],
  tasks = [] as TTask[],
  focusBlocks = [] as ReturnType<typeof focusBlock>[],
  isLoading = false,
} = {}) => {
  mockUseDailyHabits.mockReturnValue([habits, { isLoading }] as never);
  mockUseCalendarEvents.mockReturnValue([events, { isLoading }] as never);
  mockUseTasks.mockReturnValue([tasks, { isLoading }] as never);
  mockUseFocusBlocks.mockReturnValue([focusBlocks, { isLoading }] as never);
};

const preferences = (
  overrides: { enableHabits?: boolean; enableCalendar?: boolean } = {},
) =>
  [
    { enableHabits: true, enableCalendar: true, ...overrides },
    { updatePreferences: jest.fn() },
  ] as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockUsePreferences.mockReturnValue(preferences());
  setDay();
});

describe("ReviewStep", () => {
  // Every hook hands back an empty placeholder while its query resolves, so a
  // cold open looks exactly like a day where nothing happened — reporting that
  // ahead of this guard would tell someone who cleared their list that they got
  // nothing done.
  it("renders nothing rather than a premature quiet day", () => {
    setDay({ isLoading: true });

    expect(render(<ReviewStep date={DATE} />).toJSON()).toBeNull();
  });

  describe("the hero", () => {
    it("counts finished habits, closed tasks, the day's events, and focus blocks", () => {
      setDay({
        habits: [
          dailyHabit({ habitId: "a", steps: 2, stepsComplete: 2 }),
          dailyHabit({ habitId: "b", steps: 2, stepsComplete: 1 }),
        ],
        events: [event("standup"), event("review")],
        tasks: [task({ id: "1" }), task({ id: "2" }), task({ id: "3" })],
        focusBlocks: [focusBlock("complete", "a"), focusBlock("complete", "b")],
      });
      render(<ReviewStep date={DATE} />);

      // One accessibility node per line carries the whole phrase, which is what
      // the hero reads as — and pins the pluralization at both ends.
      expect(screen.getByLabelText("1 habit done")).toBeTruthy();
      expect(screen.getByLabelText("3 tasks done")).toBeTruthy();
      expect(screen.getByLabelText("2 events")).toBeTruthy();
      expect(screen.getByLabelText("2 focus blocks")).toBeTruthy();
    });

    it("says 'tasks' for none of them and 'task' for one", () => {
      render(<ReviewStep date={DATE} />);
      expect(screen.getByLabelText("0 tasks done")).toBeTruthy();

      setDay({ tasks: [task()] });
      screen.rerender(<ReviewStep date={DATE} />);
      expect(screen.getByLabelText("1 task done")).toBeTruthy();
    });

    // A habit paused or archived after the fact keeps its row until the trigger
    // clears it, and a habit edit doesn't invalidate the dailyHabits cache — so
    // the hero would otherwise count a habit the ring row below it no longer
    // draws.
    it("ignores rows for habits since paused or archived", () => {
      setDay({
        habits: [
          dailyHabit({ habitId: "a" }),
          dailyHabit({ habitId: "b", isPaused: true }),
          dailyHabit({ habitId: "c", isArchived: true }),
        ],
      });
      render(<ReviewStep date={DATE} />);

      expect(screen.getByLabelText("1 habit done")).toBeTruthy();
    });

    // The rule the summary step set: a line exists per feature the reader has,
    // not per non-zero count, so a zero still reads but a calendar line for
    // someone with no calendar is noise.
    it("drops the habit and event lines when those features are off", () => {
      mockUsePreferences.mockReturnValue(
        preferences({ enableHabits: false, enableCalendar: false }),
      );
      setDay({ tasks: [task()] });
      render(<ReviewStep date={DATE} />);

      expect(screen.getByLabelText("1 task done")).toBeTruthy();
      expect(screen.getByLabelText("0 focus blocks")).toBeTruthy();
      expect(screen.queryByLabelText(/habit done/)).toBeNull();
      expect(screen.queryByLabelText(/event/)).toBeNull();
    });

    // The reason `cancelled` is its own status rather than a deleted row: a
    // block stopped early is recorded honestly and still kept out of the
    // evening's figure. A block still running hasn't happened yet either.
    it("counts only completed focus blocks, not cancelled or running ones", () => {
      setDay({
        focusBlocks: [
          focusBlock("complete"),
          focusBlock("cancelled"),
          focusBlock("active"),
          focusBlock("paused"),
        ],
      });
      render(<ReviewStep date={DATE} />);

      expect(screen.getByLabelText("1 focus block")).toBeTruthy();
    });
  });

  describe("the completed list", () => {
    // Scope is the ritual's own day and only what was closed out — the exact
    // complement of the open tasks step two swipes back, so no task shows in
    // both and neither list is the other's leftovers.
    it("lists every terminal status on the day and nothing else", () => {
      setDay({
        tasks: [
          task({ id: "1", title: "Finished", status: ETaskStatus.DONE }),
          task({ id: "2", title: "Abandoned", status: ETaskStatus.WONT_DO }),
          task({ id: "3", title: "Handed off", status: ETaskStatus.DELEGATED }),
          task({ id: "4", title: "Still open", status: ETaskStatus.TODO }),
          task({ id: "5", title: "Underway", status: ETaskStatus.IN_PROGRESS }),
          task({ id: "6", title: "Yesterday's", scheduledFor: OTHER_DAY }),
        ],
      });
      render(<ReviewStep date={DATE} />);

      expect(screen.getByLabelText("3 tasks done")).toBeTruthy();
      expect(screen.getByText("card:Finished")).toBeTruthy();
      expect(screen.getByText("card:Abandoned")).toBeTruthy();
      expect(screen.getByText("card:Handed off")).toBeTruthy();
      expect(screen.queryByText("card:Still open")).toBeNull();
      expect(screen.queryByText("card:Underway")).toBeNull();
      expect(screen.queryByText("card:Yesterday's")).toBeNull();
    });
  });

  describe("a day with nothing closed out", () => {
    // The rings are the one interactive thing on the step, so a day with no
    // finished tasks still has a body worth drawing — a habit ticked after
    // dinner is exactly what an evening review is for.
    it("keeps the habit row and stays out of the centered branch", () => {
      render(<ReviewStep date={DATE} />);

      expect(screen.getByText("habit-tracker")).toBeTruthy();
      expect(screen.queryByTestId("review-step-quiet")).toBeNull();
    });

    // Nothing to list *and* no rings to tap leaves an empty box under the hero,
    // so the figures center in the step instead.
    it("centers the figures once there are no rings either", () => {
      mockUsePreferences.mockReturnValue(preferences({ enableHabits: false }));
      render(<ReviewStep date={DATE} />);

      expect(screen.getByTestId("review-step-quiet")).toBeTruthy();
      expect(screen.queryByText("habit-tracker")).toBeNull();
      expect(screen.getByLabelText("0 tasks done")).toBeTruthy();
    });
  });
});
