import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet, TextStyle } from "react-native";
import type { ReactTestInstance } from "react-test-renderer";

import { ETaskPriority } from "@/api/tasks";
import { CalendarStep } from "@/components/CalendarStep";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { TCalendarEvent } from "@/hooks/useCalendarEvents.types";
import { usePreferences } from "@/hooks/usePreferences";
import { themes } from "@/utils/theme";

jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/hooks/useCalendarEvents", () => ({
  useCalendarEvents: jest.fn(),
}));

// The timeline has its own suite (`CalendarView.test.tsx`) and its own layout
// measurement; standing it in as a marker keeps this file about the hero.
jest.mock("@/components/CalendarView", () => {
  const { Text: RNText } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return {
    CalendarView: function MockCalendarView({
      date,
    }: {
      date: Temporal.PlainDate;
    }) {
      return <RNText>{`calendar:${date.toString()}`}</RNText>;
    },
  };
});

jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUseCalendarEvents = useCalendarEvents as jest.MockedFunction<
  typeof useCalendarEvents
>;

const DATE = Temporal.PlainDate.from("2026-08-09");

const READY = {
  isLoading: false,
  isError: false,
  permissionDenied: false,
  notConfigured: false,
};

// The palette `useTheme` falls back to outside a provider on a light scheme.
const { colors } = themes.dexter;

const timed = (
  id: string,
  startHour: number,
  endHour: number,
  endMinute = 0,
): TCalendarEvent => ({
  id,
  title: id,
  start: new Temporal.PlainDateTime(2026, 8, 9, startHour, 0),
  end: new Temporal.PlainDateTime(2026, 8, 9, endHour, endMinute),
  allDay: false,
});

const renderStep = ({
  events = [],
  meta = {},
}: {
  events?: TCalendarEvent[];
  meta?: Partial<typeof READY>;
} = {}) => {
  mockUseCalendarEvents.mockReturnValue([events, { ...READY, ...meta }]);
  return render(<CalendarStep date={DATE} />);
};

/** The color a rendered `<Text>` resolves to, for the hero's ink assertions. */
const colorOf = (node: ReactTestInstance) =>
  StyleSheet.flatten(node.props.style as TextStyle).color;

beforeEach(() => {
  jest.clearAllMocks();
  // A 6→20 window, so fourteen hours are on offer and the arithmetic below is
  // readable by hand.
  mockUsePreferences.mockReturnValue([
    {
      enableCalendar: true,
      calendarUrls: [],
      calendarStartTime: "06:00:00",
      calendarEndTime: "20:00:00",
    } as never,
    { updatePreferences: jest.fn() },
  ]);
});

describe("CalendarStep", () => {
  // Loading is checked first because an unresolved read looks exactly like a
  // user with no calendars — the wrong order flashes the setup prompt at a
  // configured user on every cold open.
  it("renders nothing at all while the day is still loading", () => {
    const screen = renderStep({
      meta: { isLoading: true, notConfigured: true },
    });

    expect(screen.queryByText("Set up calendars")).toBeNull();
    expect(screen.queryByLabelText(/events$/)).toBeNull();
    expect(screen.queryByText(/^calendar:/)).toBeNull();
  });

  describe("with no calendar source", () => {
    it("offers to set one up", () => {
      const screen = renderStep({ meta: { notConfigured: true } });

      expect(screen.getByText(/No calendars yet/)).toBeTruthy();
      expect(screen.queryByText(/^calendar:/)).toBeNull();
    });

    it("sends the user to the setting that fixes it", () => {
      const screen = renderStep({ meta: { notConfigured: true } });

      fireEvent.press(screen.getByText("Set up calendars"));

      expect(mockPush).toHaveBeenCalledWith("/settings/calendars");
    });

    // A denied grant is the same dead end from the user's side, so it lands on
    // the same screen — with copy that doesn't blame them for a list they never
    // got to see.
    it("treats a denied permission the same way, with its own copy", () => {
      const screen = renderStep({
        meta: { notConfigured: true, permissionDenied: true },
      });

      expect(screen.getByText(/can't see your calendar/)).toBeTruthy();
      expect(screen.getByText("Set up calendars")).toBeTruthy();
    });
  });

  // A dropped connection is not a configuration problem, so it gets no button
  // offering to fix something that isn't broken.
  it("reports a failed read without offering setup", () => {
    const screen = renderStep({ meta: { isError: true } });

    expect(screen.getByText(/Couldn't load your calendars/)).toBeTruthy();
    expect(screen.queryByText("Set up calendars")).toBeNull();
  });

  describe("with an empty day", () => {
    it("says so in two lines and draws no timeline", () => {
      const screen = renderStep();

      expect(screen.getByText("No events today")).toBeTruthy();
      expect(screen.getByText("Enjoy the space")).toBeTruthy();
      expect(screen.queryByText(/^calendar:/)).toBeNull();
    });

    it("colors the invitation rather than the fact", () => {
      const screen = renderStep();

      expect(colorOf(screen.getByText("No events today"))).toBe(colors.text);
      expect(colorOf(screen.getByText("Enjoy the space"))).toBe(colors.success);
    });
  });

  // Three lines in a column, the figures right-aligned against a shared width —
  // the same hero the Backlog step uses (`HeroLines`), which is where the
  // layout and the stagger are covered. These are about the copy and the ink.
  describe("with a day that has events", () => {
    it("counts the events and splits the window", () => {
      const screen = renderStep({
        events: [timed("a", 9, 11), timed("b", 14, 15), timed("c", 16, 18, 30)],
      });

      expect(screen.getByLabelText("3 events")).toBeTruthy();
      expect(screen.getByLabelText("5h 30m planned")).toBeTruthy();
      expect(screen.getByLabelText("8h 30m free")).toBeTruthy();
      expect(screen.getByText(`calendar:${DATE.toString()}`)).toBeTruthy();
    });

    it("writes the singular for one event", () => {
      const screen = renderStep({ events: [timed("a", 9, 10)] });

      expect(screen.getByLabelText("1 event")).toBeTruthy();
      expect(screen.getByLabelText("1h planned")).toBeTruthy();
      expect(screen.getByLabelText("13h free")).toBeTruthy();
    });

    // Time booked reads as spent, time left as available — the figures carry
    // that, and the words beside them stay in ink. The count takes the same
    // warning token the backlog step's "due soon" figure does: a day's events
    // are a heads-up, neither the failure `error` marks nor an all-clear.
    it("colors the figures rather than the words", () => {
      const screen = renderStep({ events: [timed("a", 9, 10, 30)] });

      expect(colorOf(screen.getByTestId("hero-figure-events"))).toBe(
        colors.priority[ETaskPriority.IMPORTANT_AND_URGENT],
      );
      expect(colorOf(screen.getByTestId("hero-figure-planned"))).toBe(
        colors.error,
      );
      expect(colorOf(screen.getByTestId("hero-figure-free"))).toBe(
        colors.success,
      );
    });

    // Only all-day events: counted, but nothing on the timeline is spoken for.
    it("counts an all-day event without booking any time", () => {
      const screen = renderStep({
        events: [
          {
            id: "holiday",
            title: "Holiday",
            start: new Temporal.PlainDateTime(2026, 8, 9, 0, 0),
            end: new Temporal.PlainDateTime(2026, 8, 10, 0, 0),
            allDay: true,
          },
        ],
      });

      expect(screen.getByLabelText("1 event")).toBeTruthy();
      expect(screen.getByLabelText("0h planned")).toBeTruthy();
      expect(screen.getByLabelText("14h free")).toBeTruthy();
    });
  });
});
