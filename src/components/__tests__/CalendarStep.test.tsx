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
  // Loading checked first — an unresolved read looks like "no calendars",
  // and the wrong order flashes the setup prompt at a configured user.
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

    // Same dead end from the user's side, so the same screen — with copy
    // that doesn't blame them for a list they never saw.
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

  // Same hero as Backlog (`HeroLines`), which covers layout/stagger — these
  // are about the copy and the ink.
  describe("with a day that has events", () => {
    it("counts the events and splits the window", () => {
      const screen = renderStep({
        events: [timed("a", 9, 11), timed("b", 14, 15), timed("c", 16, 18, 30)],
      });

      expect(screen.getByLabelText("3 events")).toBeTruthy();
      expect(screen.getByLabelText("5.5 hours planned")).toBeTruthy();
      expect(screen.getByLabelText("8.5 hours free")).toBeTruthy();
      expect(screen.getByText(`calendar:${DATE.toString()}`)).toBeTruthy();
    });

    // Pluralizing on wholeness would print "1 hours planned"; exactly sixty
    // minutes is the one span that takes the singular.
    it("writes the singular for one event and one hour", () => {
      const screen = renderStep({ events: [timed("a", 9, 10)] });

      expect(screen.getByLabelText("1 event")).toBeTruthy();
      expect(screen.getByLabelText("1 hour planned")).toBeTruthy();
      expect(screen.getByLabelText("13 hours free")).toBeTruthy();
    });

    // Figures carry the color, words stay ink; events take the same warning
    // token as backlog's due-soon — a heads-up, not `error` or an all-clear.
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
      expect(screen.getByLabelText("0 hours planned")).toBeTruthy();
      expect(screen.getByLabelText("14 hours free")).toBeTruthy();
    });
  });
});
