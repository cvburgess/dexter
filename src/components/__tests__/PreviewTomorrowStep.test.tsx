import { Temporal } from "@js-temporal/polyfill";
import { render, screen } from "@testing-library/react-native";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { PreviewTomorrowStep } from "@/components/PreviewTomorrowStep";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import type { TCalendarEvent } from "@/hooks/useCalendarEvents.types";
import { usePreferences } from "@/hooks/usePreferences";
import { useTasks } from "@/hooks/useTasks";

// useTasks imports the supabase client from useAuth, which reads the app's URI
// scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useTasks", () => ({
  ...jest.requireActual<typeof import("@/hooks/useTasks")>("@/hooks/useTasks"),
  useTasks: jest.fn(),
}));
jest.mock("@/hooks/useCalendarEvents", () => ({
  useCalendarEvents: jest.fn(),
}));
jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
// Reached only through `useTaskDelete` (own suite); real functions rather than
// `{}` so a delete added here fails on the assertion, not on a missing method.
jest.mock("@/hooks/useTemplates", () => ({
  useTemplates: jest.fn(() => [
    [],
    { deleteTemplate: jest.fn(), getTemplateById: () => undefined },
  ]),
}));

// The card has its own suite and carries `@expo/ui` menu hosts a unit test
// can't drive; a marker stand-in keeps this file about the sentence and lists.
const mockTaskCard = jest.fn();
jest.mock("@/components/TaskCard", () => {
  const { Text: RNText } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    TaskCard: function MockTaskCard(props: { task: { title: string } }) {
      mockTaskCard(props);
      return <RNText>{`card:${props.task.title}`}</RNText>;
    },
  };
});

jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockUseCalendarEvents = useCalendarEvents as jest.MockedFunction<
  typeof useCalendarEvents
>;
const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;

// A Wednesday, so the step previews a Thursday and the sentence has a weekday
// worth naming.
const DATE = Temporal.PlainDate.from("2026-08-12");
const TOMORROW = "2026-08-13";
/** The four Thursdays the comparison averages. */
const HISTORY = ["2026-08-06", "2026-07-30", "2026-07-23", "2026-07-16"];

const task = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.UNPRIORITIZED,
  scheduledFor: TOMORROW,
  status: ETaskStatus.TODO,
  subtasks: [],
  templateId: null,
  title: "Write report",
  url: null,
  ...overrides,
});

/** `n` tasks on `date`, distinct ids so nothing collides across days. */
const tasksOn = (date: string, count: number): TTask[] =>
  Array.from({ length: count }, (_unused, index) =>
    task({ id: `${date}-${index}`, scheduledFor: date, title: `${date} task` }),
  );

const timed = (
  id: string,
  startHour: number,
  endHour: number,
  endMinute = 0,
): TCalendarEvent => ({
  id,
  title: id,
  start: new Temporal.PlainDateTime(2026, 8, 13, startHour, 0),
  end: new Temporal.PlainDateTime(2026, 8, 13, endHour, endMinute),
  allDay: false,
});

/** Whole hours of booked time on a history day, so the average reads by hand. */
const hoursOn = (date: string, hours: number): TCalendarEvent[] =>
  hours === 0
    ? []
    : [
        {
          id: `${date}-booked`,
          title: `${date} booked`,
          start: Temporal.PlainDateTime.from(`${date}T09:00`),
          end: Temporal.PlainDateTime.from(`${date}T09:00`).add({ hours }),
          allDay: false,
        },
      ];

const READY = {
  isLoading: false,
  isError: false,
  permissionDenied: false,
  notConfigured: false,
};

// The step calls `useCalendarEvents` once for tomorrow and once per history
// day, so the mock answers by date rather than returning one array.
const renderStep = ({
  events = [] as TCalendarEvent[],
  history = {},
  tasks = [] as TTask[],
  meta = {},
  enableCalendar = true,
}: {
  events?: TCalendarEvent[];
  history?: Record<string, TCalendarEvent[]>;
  tasks?: TTask[];
  meta?: Partial<typeof READY>;
  enableCalendar?: boolean;
} = {}) => {
  const byDate: Record<string, TCalendarEvent[]> = {
    [TOMORROW]: events,
    ...history,
  };
  mockUseCalendarEvents.mockImplementation((date) => [
    byDate[date.toString()] ?? [],
    { ...READY, ...meta },
  ]);
  mockUseTasks.mockReturnValue([tasks, { isLoading: false }] as never);
  mockUsePreferences.mockReturnValue([
    {
      enableCalendar,
      calendarStartTime: "06:00:00",
      calendarEndTime: "20:00:00",
    },
    { updatePreferences: jest.fn() },
  ] as never);

  return render(
    <PreviewTomorrowStep date={DATE} onEditingChange={jest.fn()} />,
  );
};

/** The hero sentence as prose — the label carries the whole of it. */
const sentence = () =>
  screen.getByTestId("preview-tomorrow-sentence").props.accessibilityLabel;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PreviewTomorrowStep", () => {
  // Order is load-bearing: unresolved hooks serve empty placeholders, which
  // the empty-history rule reads as a confident "typical" that then rewrites.
  it("renders nothing at all while any of the five days is still loading", () => {
    renderStep({ meta: { isLoading: true }, tasks: tasksOn(TOMORROW, 3) });

    expect(screen.queryByTestId("preview-tomorrow-sentence")).toBeNull();
    expect(screen.queryByText(/^card:/)).toBeNull();
  });

  describe("the sentence", () => {
    it("names tomorrow's own weekday, not the ritual's", () => {
      renderStep();

      expect(sentence()).toContain("Thursday");
    });

    it("invites a typical day to be more than that", () => {
      renderStep({
        tasks: [
          ...tasksOn(TOMORROW, 2),
          ...HISTORY.flatMap((d) => tasksOn(d, 2)),
        ],
      });

      expect(sentence()).toBe("Tomorrow might be a typical Thursday,");
      expect(
        screen.getByText("but you can make it extraordinary."),
      ).toBeTruthy();
    });

    it("calls a day heavier on both axes busier", () => {
      renderStep({
        tasks: [
          ...tasksOn(TOMORROW, 9),
          ...HISTORY.flatMap((d) => tasksOn(d, 2)),
        ],
        events: [timed("all morning", 9, 13)],
        history: Object.fromEntries(HISTORY.map((d) => [d, hoursOn(d, 1)])),
      });

      expect(sentence()).toBe("Tomorrow is busier than your typical Thursday.");
      expect(screen.getByText("Don't forget to eat.")).toBeTruthy();
    });

    it("calls a day lighter on both axes calmer", () => {
      renderStep({
        tasks: [
          ...tasksOn(TOMORROW, 1),
          ...HISTORY.flatMap((d) => tasksOn(d, 6)),
        ],
        history: Object.fromEntries(HISTORY.map((d) => [d, hoursOn(d, 4)])),
      });

      expect(sentence()).toBe("Tomorrow is calmer than your typical Thursday.");
      expect(screen.getByText("Enjoy the extra space.")).toBeTruthy();
    });

    it("names both axes when they disagree", () => {
      renderStep({
        tasks: [
          ...tasksOn(TOMORROW, 1),
          ...HISTORY.flatMap((d) => tasksOn(d, 6)),
        ],
        events: [timed("all morning", 9, 13)],
        history: Object.fromEntries(HISTORY.map((d) => [d, hoursOn(d, 1)])),
      });

      expect(sentence()).toBe(
        "Tomorrow has more meetings but fewer tasks than your typical Thursday.",
      );
    });

    // The guard that stops a first-time reader being told tomorrow is busier
    // than a Thursday the app has never seen.
    it("reads a day with no history at all as typical", () => {
      renderStep({
        tasks: tasksOn(TOMORROW, 9),
        events: [timed("all morning", 9, 13)],
      });

      expect(sentence()).toBe("Tomorrow might be a typical Thursday,");
    });
  });

  describe("the agenda", () => {
    it("lists each event with its span and its title", () => {
      renderStep({ events: [timed("Daily Standup", 16, 17, 15)] });

      expect(screen.getByLabelText("4:00-5:15 PM Daily Standup")).toBeTruthy();
      expect(screen.getByText("Daily Standup")).toBeTruthy();
    });

    it("labels an all-day event rather than timing it", () => {
      renderStep({
        events: [
          {
            id: "birthday",
            title: "Tanya's Birthday",
            start: Temporal.PlainDateTime.from(`${TOMORROW}T00:00`),
            end: Temporal.PlainDateTime.from("2026-08-14T00:00"),
            allDay: true,
          },
        ],
      });

      expect(screen.getByLabelText("all-day Tanya's Birthday")).toBeTruthy();
    });

    it("puts the all-day event above the timed ones", () => {
      renderStep({
        events: [
          timed("Daily Standup", 9, 10),
          {
            id: "birthday",
            title: "Tanya's Birthday",
            start: Temporal.PlainDateTime.from(`${TOMORROW}T00:00`),
            end: Temporal.PlainDateTime.from("2026-08-14T00:00"),
            allDay: true,
          },
        ],
      });

      const times = screen
        .getAllByTestId(/^event-time-/)
        .map((node) => node.props.children);
      expect(times).toEqual(["all-day", "9:00-10:00 AM"]);
    });

    it("says so when tomorrow holds no events", () => {
      renderStep();

      expect(screen.getByText("No events tomorrow")).toBeTruthy();
    });

    it("is absent entirely when the calendar is off", () => {
      renderStep({ enableCalendar: false, tasks: tasksOn(TOMORROW, 1) });

      expect(screen.queryByText("No events tomorrow")).toBeNull();
    });

    // A calendar with no source takes the same path as one switched off, not
    // an inline setup prompt stranded below the fold.
    it("is absent when the calendar has no source behind it", () => {
      renderStep({ meta: { notConfigured: true } });

      expect(screen.queryByText("No events tomorrow")).toBeNull();
    });

    // A failed read hands back an empty array — indistinguishable from a clear
    // day, which would read as "calmer" because the wifi dropped.
    it("says a read failed rather than claiming the day is empty", () => {
      renderStep({ meta: { isError: true } });

      expect(screen.getByText("Couldn't load your calendars")).toBeTruthy();
      expect(screen.queryByText("No events tomorrow")).toBeNull();
    });

    it("drops the meetings axis when any of the five reads failed", () => {
      renderStep({
        meta: { isError: true },
        tasks: [
          ...tasksOn(TOMORROW, 2),
          ...HISTORY.flatMap((d) => tasksOn(d, 2)),
        ],
        history: Object.fromEntries(HISTORY.map((d) => [d, hoursOn(d, 4)])),
      });

      expect(sentence()).toBe("Tomorrow might be a typical Thursday,");
    });

    it("never mentions meetings when the calendar is off", () => {
      renderStep({
        enableCalendar: false,
        tasks: [
          ...tasksOn(TOMORROW, 9),
          ...HISTORY.flatMap((d) => tasksOn(d, 2)),
        ],
      });

      expect(sentence()).toBe(
        "Tomorrow has more tasks than your typical Thursday.",
      );
    });
  });

  describe("the task list", () => {
    it("draws a card per task scheduled for tomorrow", () => {
      renderStep({
        tasks: [
          task({ id: "a", title: "Write report" }),
          task({ id: "b", title: "Call the vet" }),
        ],
      });

      expect(screen.getByText("card:Write report")).toBeTruthy();
      expect(screen.getByText("card:Call the vet")).toBeTruthy();
    });

    // The step previews `date + 1`, so the ritual's own day must not leak into
    // it — that would make it a second copy of the step two swipes back.
    it("leaves the ritual's own day out of it", () => {
      renderStep({
        tasks: [
          task({
            id: "today",
            scheduledFor: DATE.toString(),
            title: "Today's",
          }),
          task({ id: "tomorrow", title: "Tomorrow's" }),
        ],
      });

      expect(screen.getByText("card:Tomorrow's")).toBeTruthy();
      expect(screen.queryByText("card:Today's")).toBeNull();
    });

    it("says so when tomorrow holds no tasks", () => {
      renderStep();

      expect(screen.getByText("No tasks tomorrow")).toBeTruthy();
    });

    // Open cards rename, so a drag across a live field would page the ritual;
    // unwrapped because `TaskCard` notifies from an effect keyed on identity.
    it("hands each card the editing callback, unwrapped", () => {
      const onEditingChange = jest.fn();
      mockUseCalendarEvents.mockReturnValue([[], READY]);
      mockUseTasks.mockReturnValue([[task()], { isLoading: false }] as never);
      mockUsePreferences.mockReturnValue([
        {
          enableCalendar: false,
          calendarStartTime: "06:00:00",
          calendarEndTime: "20:00:00",
        },
        { updatePreferences: jest.fn() },
      ] as never);

      render(
        <PreviewTomorrowStep date={DATE} onEditingChange={onEditingChange} />,
      );

      expect(mockTaskCard).toHaveBeenCalledWith(
        expect.objectContaining({ onEditingChange }),
      );
    });
  });
});
