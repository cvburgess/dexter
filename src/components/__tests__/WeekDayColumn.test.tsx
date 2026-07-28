import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import { useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";
import type { ViewStyle } from "react-native";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";
import { formatMonthDay, formatWeekday } from "@/utils/formatPlainDate";
import { Theme, useTheme, withOpacity } from "@/utils/theme";

import { WeekDayColumn } from "../WeekDayColumn";

// useTasks imports the supabase client from useAuth, which reads the app's
// URI scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useTasks", () => ({
  ...jest.requireActual<typeof import("@/hooks/useTasks")>("@/hooks/useTasks"),
  useTasks: jest.fn(),
}));
jest.mock("@/hooks/useTemplates", () => ({ useTemplates: jest.fn() }));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: jest.fn() }));

// The habit tracker runs its own queries and is covered by its own tests;
// stub it to a marker that echoes the props this column wires up.
const mockHabitTracker = jest.fn(
  ({ showCreateNudge }: { showCreateNudge?: boolean }) => (
    <Text>{`habit-tracker:nudge=${String(showCreateNudge)}`}</Text>
  ),
);
jest.mock("@/components/HabitTracker", () => ({
  HabitTracker: (props: { showCreateNudge?: boolean }) =>
    mockHabitTracker(props),
}));

// TaskCard wraps native menus that can't be driven from a unit test.
jest.mock("@/components/TaskCard", () => {
  const { Text: RNText } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    TaskCard: ({ task }: { task: TTask }) => <RNText>{task.title}</RNText>,
  };
});

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockUseTemplates = useTemplates as jest.MockedFunction<
  typeof useTemplates
>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

const tasksResult = (tasks: TTask[] = []) =>
  [
    tasks,
    {
      createTask: jest.fn(),
      deleteTask: jest.fn(),
      isLoading: false,
      updateTask: jest.fn(),
      updateTasks: jest.fn(),
    },
  ] as ReturnType<typeof useTasks>;

const task = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  title: "Write the report",
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.URGENT,
  scheduledFor: "2026-07-29",
  status: ETaskStatus.TODO,
  subtasks: [],
  templateId: null,
  ...overrides,
});

// 2026-07-29 is a Wednesday, and deliberately not today.
const date = Temporal.PlainDate.from("2026-07-29");

const chipStyle = (
  screen: ReturnType<typeof render>,
  day: Temporal.PlainDate,
) =>
  StyleSheet.flatten(
    screen.getByTestId(`week-chip-${day.toString()}`).props
      .style as ViewStyle[],
  );

/**
 * The theme the component resolves under test, read through the same hook it
 * uses. Asserting against this rather than a hardcoded hex keeps these tests
 * honest if the no-provider fallback theme ever changes.
 */
const resolvedTheme = (): Theme => {
  let theme: Theme | undefined;
  const Probe = () => {
    theme = useTheme();
    return null;
  };
  render(<Probe />);
  if (!theme) throw new Error("useTheme did not resolve");
  return theme;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTasks.mockReturnValue(tasksResult());
  mockUseTemplates.mockReturnValue([
    [],
    { deleteTemplate: jest.fn(), getTemplateById: jest.fn() },
  ] as never);
  mockUseRouter.mockReturnValue({ push: mockPush } as never);
});

describe("WeekDayColumn", () => {
  it("labels the column with the weekday and numeric date", () => {
    const screen = render(<WeekDayColumn date={date} enableHabits={false} />);

    expect(screen.getByText("Wednesday")).toBeTruthy();
    expect(screen.getByText("7/29")).toBeTruthy();
  });

  it("renders only the tasks scheduled for its own day", () => {
    mockUseTasks.mockReturnValue(
      tasksResult([
        task({ id: "1", title: "Mine", scheduledFor: "2026-07-29" }),
        task({ id: "2", title: "Tomorrow's", scheduledFor: "2026-07-30" }),
      ]),
    );

    const screen = render(<WeekDayColumn date={date} enableHabits={false} />);

    expect(screen.getByText("Mine")).toBeTruthy();
    expect(screen.queryByText("Tomorrow's")).toBeNull();
  });

  it("shows a short empty state so it fits a narrow column", () => {
    const screen = render(<WeekDayColumn date={date} enableHabits={false} />);

    expect(screen.getByText("No tasks")).toBeTruthy();
  });

  it("opens the create-task modal already scheduled for its own day", () => {
    const screen = render(<WeekDayColumn date={date} enableHabits={false} />);

    fireEvent.press(screen.getByLabelText("New task on Wednesday 7/29"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/new-task",
      params: { scheduledFor: "2026-07-29" },
    });
  });

  describe("habits", () => {
    it("renders the tracker when habits are enabled", () => {
      const screen = render(<WeekDayColumn date={date} enableHabits />);

      expect(screen.getByText("habit-tracker:nudge=false")).toBeTruthy();
    });

    it("suppresses the create-a-habit nudge", () => {
      // Seven columns would otherwise show seven copies of the same link.
      render(<WeekDayColumn date={date} enableHabits />);

      expect(mockHabitTracker).toHaveBeenCalledWith(
        expect.objectContaining({ showCreateNudge: false }),
      );
    });

    it("hides the tracker when habits are disabled", () => {
      const screen = render(<WeekDayColumn date={date} enableHabits={false} />);

      expect(screen.queryByText(/habit-tracker/)).toBeNull();
    });
  });

  describe("today's column", () => {
    const today = Temporal.Now.plainDateISO();

    it("fills the chip with the inverted ink color", () => {
      // Resolved through the same hook the component uses rather than
      // hardcoded, so this keeps holding if the default theme changes.
      const theme = resolvedTheme();
      const screen = render(
        <WeekDayColumn date={today} enableHabits={false} />,
      );

      // The pair WebNavRail uses for its selected tile.
      expect(chipStyle(screen, today).backgroundColor).toBe(
        withOpacity(theme.colors.text, 0.8),
      );
    });

    it("draws today's label in the background color so it reads on the fill", () => {
      const theme = resolvedTheme();
      const screen = render(
        <WeekDayColumn date={today} enableHabits={false} />,
      );

      expect(
        StyleSheet.flatten(
          screen.getByText(formatWeekday(today)).props.style as ViewStyle[],
        ).color,
      ).toBe(theme.colors.background);
    });

    it("announces itself as today to assistive tech", () => {
      const screen = render(
        <WeekDayColumn date={today} enableHabits={false} />,
      );

      expect(
        screen.getByLabelText(
          `${formatWeekday(today)} ${formatMonthDay(today)}, today`,
        ),
      ).toBeTruthy();
    });

    it("leaves other days' chips unfilled and unlabelled as today", () => {
      const theme = resolvedTheme();
      const screen = render(<WeekDayColumn date={date} enableHabits={false} />);

      // No ", today" suffix, and no fill.
      expect(
        screen.getByLabelText(`${formatWeekday(date)} ${formatMonthDay(date)}`),
      ).toBeTruthy();
      expect(chipStyle(screen, date).backgroundColor).toBe("transparent");
      expect(chipStyle(screen, date).backgroundColor).not.toBe(
        withOpacity(theme.colors.text, 0.8),
      );
    });
  });
});
