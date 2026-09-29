import { Temporal } from "@js-temporal/polyfill";
import { render, renderHook } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import type { TextStyle, ViewStyle } from "react-native";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { TCalendarEvent } from "@/hooks/useCalendarEvents.types";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";
import { formatMonthDay, formatWeekday } from "@/utils/formatPlainDate";
import { useTheme, withOpacity } from "@/utils/theme";

import { WeekDayColumn } from "../WeekDayColumn";

// useTasks imports the supabase client from useAuth, which reads the app's
// URI scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useTasks", () => ({
  ...jest.requireActual<typeof import("@/hooks/useTasks")>("@/hooks/useTasks"),
  useTasks: jest.fn(),
}));
jest.mock("@/hooks/useTemplates", () => ({ useTemplates: jest.fn() }));

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

jest.mock("@/hooks/useCalendarEvents", () => ({
  useCalendarEvents: jest.fn(),
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
const mockUseCalendarEvents = jest.mocked(useCalendarEvents);

const calendarResult = (
  events: TCalendarEvent[],
  status: Partial<ReturnType<typeof useCalendarEvents>[1]> = {},
): ReturnType<typeof useCalendarEvents> => [
  events,
  {
    isLoading: false,
    isError: false,
    permissionDenied: false,
    notConfigured: false,
    ...status,
  },
];

const event = (overrides: Partial<TCalendarEvent> = {}): TCalendarEvent => ({
  id: "event-1",
  title: "Design review",
  start: Temporal.PlainDateTime.from("2026-07-29T16:00"),
  end: Temporal.PlainDateTime.from("2026-07-29T17:00"),
  allDay: false,
  ...overrides,
});
const mockUseTemplates = useTemplates as jest.MockedFunction<
  typeof useTemplates
>;

const tasksResult = (tasks: TTask[] = []) =>
  [
    tasks,
    {
      createTask: jest.fn(),
      deleteTask: jest.fn(),
      isError: false,
      isLoading: false,
      refetch: jest.fn(),
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
  url: null,
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

// Resolved through the same hook the component uses rather than hardcoded, so
// these assertions keep holding if the no-provider fallback theme changes.
const theme = renderHook(() => useTheme()).result.current;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTasks.mockReturnValue(tasksResult());
  mockUseTemplates.mockReturnValue([
    [],
    { deleteTemplate: jest.fn(), getTemplateById: jest.fn() },
  ] as never);
});

describe("WeekDayColumn", () => {
  it("labels the column with the weekday and numeric date", () => {
    const screen = render(
      <WeekDayColumn
        date={date}
        enableHabits={false}
        isToday={false}
        showCalendar={false}
      />,
    );

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

    const screen = render(
      <WeekDayColumn
        date={date}
        enableHabits={false}
        isToday={false}
        showCalendar={false}
      />,
    );

    expect(screen.getByText("Mine")).toBeTruthy();
    expect(screen.queryByText("Tomorrow's")).toBeNull();
  });

  it("renders no empty-state message when the day has no tasks", () => {
    // Seven of them side by side read as noise, and an empty column already
    // says what it needs to.
    const screen = render(
      <WeekDayColumn
        date={date}
        enableHabits={false}
        isToday={false}
        showCalendar={false}
      />,
    );

    expect(screen.queryByText(/no tasks/i)).toBeNull();
    // The chip still renders, so this isn't passing on an empty tree.
    expect(screen.getByText("Wednesday")).toBeTruthy();
  });

  it("offers no per-column create affordance", () => {
    // Creating goes through the tab's single "+" (see WeekView).
    const screen = render(
      <WeekDayColumn
        date={date}
        enableHabits={false}
        isToday={false}
        showCalendar={false}
      />,
    );

    expect(screen.queryByLabelText(/new task/i)).toBeNull();
  });

  describe("habits", () => {
    it("renders the tracker when habits are enabled", () => {
      const screen = render(
        <WeekDayColumn
          date={date}
          enableHabits
          isToday={false}
          showCalendar={false}
        />,
      );

      expect(screen.getByText("habit-tracker:nudge=false")).toBeTruthy();
    });

    it("suppresses the create-a-habit nudge", () => {
      // Seven columns would otherwise show seven copies of the same link.
      render(
        <WeekDayColumn
          date={date}
          enableHabits
          isToday={false}
          showCalendar={false}
        />,
      );

      expect(mockHabitTracker).toHaveBeenCalledWith(
        expect.objectContaining({ showCreateNudge: false }),
      );
    });

    it("hides the tracker when habits are disabled", () => {
      const screen = render(
        <WeekDayColumn
          date={date}
          enableHabits={false}
          isToday={false}
          showCalendar={false}
        />,
      );

      expect(screen.queryByText(/habit-tracker/)).toBeNull();
    });
  });

  describe("calendar events (DEX-186)", () => {
    it("lists the day's events, all-day first, when shown", () => {
      mockUseCalendarEvents.mockReturnValue(
        calendarResult([
          event({ id: "timed", title: "Design review" }),
          event({ id: "allday", title: "Offsite", allDay: true }),
        ]),
      );

      const screen = render(
        <WeekDayColumn
          date={date}
          enableHabits={false}
          isToday={false}
          showCalendar
        />,
      );

      expect(mockUseCalendarEvents).toHaveBeenCalledWith(date);
      const labels = screen
        .getAllByLabelText(/Design review|Offsite/)
        .map((node) => node.props.accessibilityLabel as string);
      expect(labels).toEqual(["all-day Offsite", "4:00-5:00 PM Design review"]);
    });

    it("doesn't read the calendar when hidden", () => {
      render(
        <WeekDayColumn
          date={date}
          enableHabits={false}
          isToday={false}
          showCalendar={false}
        />,
      );

      expect(mockUseCalendarEvents).not.toHaveBeenCalled();
    });

    it("shows nothing for a failed read, not an error in every column", () => {
      mockUseCalendarEvents.mockReturnValue(
        calendarResult([], { isError: true }),
      );

      const screen = render(
        <WeekDayColumn
          date={date}
          enableHabits={false}
          isToday={false}
          showCalendar
        />,
      );

      expect(screen.queryByTestId(`week-events-${date.toString()}`)).toBeNull();
      expect(screen.queryByText(/calendar/i)).toBeNull();
    });
  });

  describe("today's column", () => {
    const today = Temporal.Now.plainDateISO();

    it("fills the chip with the inverted ink color", () => {
      const screen = render(
        <WeekDayColumn
          date={today}
          enableHabits={false}
          isToday
          showCalendar={false}
        />,
      );

      // The pair NavRail uses for its selected tile.
      expect(chipStyle(screen, today).backgroundColor).toBe(
        withOpacity(theme.colors.text, 0.8),
      );
    });

    it("draws today's label in the background color so it reads on the fill", () => {
      const screen = render(
        <WeekDayColumn
          date={today}
          enableHabits={false}
          isToday
          showCalendar={false}
        />,
      );

      expect(
        StyleSheet.flatten(
          screen.getByText(formatWeekday(today)).props.style as TextStyle[],
        ).color,
      ).toBe(theme.colors.background);
    });

    it("announces itself as today to assistive tech", () => {
      const screen = render(
        <WeekDayColumn
          date={today}
          enableHabits={false}
          isToday
          showCalendar={false}
        />,
      );

      expect(
        screen.getByLabelText(
          `${formatWeekday(today)} ${formatMonthDay(today)}, today`,
        ),
      ).toBeTruthy();
    });

    it("leaves other days' chips unfilled and unlabelled as today", () => {
      const screen = render(
        <WeekDayColumn
          date={date}
          enableHabits={false}
          isToday={false}
          showCalendar={false}
        />,
      );

      // No ", today" suffix, and no fill.
      expect(
        screen.getByLabelText(`${formatWeekday(date)} ${formatMonthDay(date)}`),
      ).toBeTruthy();
      expect(chipStyle(screen, date).backgroundColor).toBe("transparent");
    });
  });
});
