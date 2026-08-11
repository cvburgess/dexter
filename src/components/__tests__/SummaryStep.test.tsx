import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { useRouter } from "expo-router";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import type { TCalendarEvent } from "@/hooks/useCalendarEvents.types";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useHabits } from "@/hooks/useHabits";
import { usePreferences } from "@/hooks/usePreferences";
import { useTasks } from "@/hooks/useTasks";

import { SummaryStep } from "../SummaryStep";

// useTasks imports the supabase client from useAuth, which reads the app's URI
// scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("expo-router", () => ({ useRouter: jest.fn() }));
jest.mock("@/hooks/useTasks", () => ({
  ...jest.requireActual<typeof import("@/hooks/useTasks")>("@/hooks/useTasks"),
  useTasks: jest.fn(),
}));
jest.mock("@/hooks/useHabits", () => ({
  ...jest.requireActual<typeof import("@/hooks/useHabits")>(
    "@/hooks/useHabits",
  ),
  useHabits: jest.fn(),
}));
jest.mock("@/hooks/useCalendarEvents", () => ({
  useCalendarEvents: jest.fn(),
}));
jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockUseHabits = useHabits as jest.MockedFunction<typeof useHabits>;
const mockUseCalendarEvents = useCalendarEvents as jest.MockedFunction<
  typeof useCalendarEvents
>;
const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockPush = jest.fn();

const DATE = Temporal.PlainDate.from("2026-08-09");
const BLANK = "Today is a blank canvas, go make something beautiful.";

const task = (id: string): TTask => ({
  id,
  alarmTime: null,
  title: id,
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.URGENT,
  // Must match the step's date — the step filters the canonical fetch down to
  // the viewed day client-side (DEX-57).
  scheduledFor: DATE.toString(),
  status: ETaskStatus.TODO,
  subtasks: [],
  templateId: null,
  url: null,
});

const event = (id: string): TCalendarEvent =>
  ({ id, title: id, allDay: true }) as TCalendarEvent;

/** Seeds all three sources at once; every count defaults to empty. */
const setDay = ({
  habits = [],
  events = [],
  tasks = [],
  isLoading = false,
}: {
  habits?: unknown[];
  events?: TCalendarEvent[];
  tasks?: TTask[];
  isLoading?: boolean;
} = {}) => {
  mockUseHabits.mockReturnValue([habits, { isLoading }] as never);
  mockUseCalendarEvents.mockReturnValue([events, { isLoading }] as never);
  mockUseTasks.mockReturnValue([tasks, { isLoading }] as never);
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
  mockUseRouter.mockReturnValue({ push: mockPush } as never);
  mockUsePreferences.mockReturnValue(preferences());
  setDay();
});

describe("SummaryStep", () => {
  describe("with something on the day", () => {
    it("counts habits, events and tasks, and closes on the line", () => {
      setDay({
        habits: [{}, {}],
        events: [event("standup")],
        tasks: [task("a"), task("b"), task("c")],
      });
      render(<SummaryStep date={DATE} />);

      // One accessibility node per line carries the whole phrase, which is what
      // the hero reads as — and pins the pluralization at both ends.
      expect(screen.getByLabelText("2 habits")).toBeTruthy();
      expect(screen.getByLabelText("1 event")).toBeTruthy();
      expect(screen.getByLabelText("3 tasks")).toBeTruthy();
      expect(screen.getByText("You got this")).toBeTruthy();
      expect(screen.queryByText(BLANK)).toBeNull();
    });

    // A zero is a reading worth stating — it is *why* the button is there — so
    // only an entirely empty day drops the figures.
    it("still counts a day whose only entry is a habit", () => {
      setDay({ habits: [{}] });
      render(<SummaryStep date={DATE} />);

      expect(screen.getByLabelText("1 habit")).toBeTruthy();
      expect(screen.getByLabelText("0 tasks")).toBeTruthy();
      expect(screen.getByText("You got this")).toBeTruthy();
    });
  });

  // A line about calendars for someone with no calendar is noise, not a
  // reading. The features the reader has decide which lines exist; the counts
  // only decide what they say.
  it("omits the lines for features the user has turned off", () => {
    mockUsePreferences.mockReturnValue(
      preferences({ enableHabits: false, enableCalendar: false }),
    );
    setDay({ tasks: [task("a")] });
    render(<SummaryStep date={DATE} />);

    expect(screen.getByLabelText("1 task")).toBeTruthy();
    expect(screen.queryByLabelText(/habit/)).toBeNull();
    expect(screen.queryByLabelText(/event/)).toBeNull();
  });

  describe("with an empty day", () => {
    it("replaces the figures with the blank-canvas line", () => {
      render(<SummaryStep date={DATE} />);

      expect(screen.getByText(BLANK)).toBeTruthy();
      expect(screen.queryByText("You got this")).toBeNull();
      expect(screen.queryByLabelText("0 tasks")).toBeNull();
    });

    it("still offers the way in", () => {
      render(<SummaryStep date={DATE} />);

      expect(screen.getByText("Start Your Day")).toBeTruthy();
    });

    // A disabled query keeps serving whatever it last cached, so turning habits
    // off does not empty `habits` for someone who had them. A total summed from
    // the hooks rather than from the visible lines counted those hidden rows and
    // held this day out of the blank state, leaving a lone "0 tasks" where the
    // canvas line belongs.
    it("ignores rows cached behind a feature the user turned off", () => {
      mockUsePreferences.mockReturnValue(preferences({ enableHabits: false }));
      setDay({ habits: [{}, {}] });
      render(<SummaryStep date={DATE} />);

      expect(screen.getByText(BLANK)).toBeTruthy();
      expect(screen.queryByLabelText("0 tasks")).toBeNull();
    });
  });

  // Every source hands back an empty placeholder while it resolves, so a cold
  // open looks exactly like a blank day — testing that state first would tell
  // someone with a full morning that they have nothing on.
  it("renders nothing at all while the counts are still loading", () => {
    setDay({ isLoading: true });
    const { toJSON } = render(<SummaryStep date={DATE} />);

    expect(toJSON()).toBeNull();
  });

  describe("the button", () => {
    it("opens the ritual's day rather than today", () => {
      setDay({ tasks: [task("a")] });
      render(<SummaryStep date={DATE} />);

      fireEvent.press(screen.getByText("Start Your Day"));

      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: "/today",
          params: expect.objectContaining({
            date: "2026-08-09",
            mode: "tasks",
          }),
        }),
      );
    });

    // Cross-tab navigation reuses the mounted Today screen and only swaps its
    // params, so without a nonce that changes per press the second visit is
    // identical and Today — having already applied it — switches tabs and does
    // nothing else.
    it("varies the link on every press", () => {
      setDay({ tasks: [task("a")] });
      render(<SummaryStep date={DATE} />);
      const button = screen.getByText("Start Your Day");

      fireEvent.press(button);
      fireEvent.press(button);

      const [first] = mockPush.mock.calls[0] as [{ params: { n: string } }];
      const [second] = mockPush.mock.calls[1] as [{ params: { n: string } }];
      expect(second.params.n).not.toBe(first.params.n);
    });
  });
});
