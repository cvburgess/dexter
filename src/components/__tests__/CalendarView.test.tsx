import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import { ScrollView } from "react-native";

import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { TCalendarEvent } from "@/hooks/useCalendarEvents.types";
import { usePreferences } from "@/hooks/usePreferences";

import { CalendarView } from "../CalendarView";

jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/hooks/useCalendarEvents", () => ({
  useCalendarEvents: jest.fn(),
}));

const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUseCalendarEvents = useCalendarEvents as jest.MockedFunction<
  typeof useCalendarEvents
>;

// Derive dates from the real clock (never a hardcoded "today") so the now line
// only exists on the day the code considers today, matching the app.
const TODAY = Temporal.Now.plainDateISO();
const TOMORROW = TODAY.add({ days: 1 });

// One timed event so the timeline renders (an empty day shows EmptyScreen with
// no ScrollView). Placed at noon, inside the full-day window below.
const eventOn = (date: Temporal.PlainDate): TCalendarEvent => ({
  id: "e1",
  title: "Standup",
  start: new Temporal.PlainDateTime(date.year, date.month, date.day, 12, 0),
  end: new Temporal.PlainDateTime(date.year, date.month, date.day, 13, 0),
  allDay: false,
});

const READY = {
  isLoading: false,
  isError: false,
  permissionDenied: false,
  notConfigured: false,
};
const setEvents = (date: Temporal.PlainDate) =>
  mockUseCalendarEvents.mockReturnValue([[eventOn(date)], READY]);

const fireLayout = (node: unknown, height: number) =>
  fireEvent(node as never, "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 300, height } },
  });

let scrollToSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  scrollToSpy = jest.spyOn(ScrollView.prototype, "scrollTo");
  // Full-day window so "now" is always inside it regardless of wall-clock
  // time — keeps the now line deterministic.
  mockUsePreferences.mockReturnValue([
    {
      enableCalendar: true,
      calendarUrls: [],
      calendarStartTime: "00:00:00",
      calendarEndTime: "23:59:59",
    } as never,
    { updatePreferences: jest.fn() },
  ]);
  setEvents(TODAY);
});

describe("CalendarView auto-scroll to now", () => {
  it("scrolls the now line into the viewport on first layout", () => {
    const { getByTestId } = render(<CalendarView date={TODAY} />);
    fireLayout(getByTestId("calendar-scroll"), 600);

    expect(scrollToSpy).toHaveBeenCalledTimes(1);
    const [arg] = scrollToSpy.mock.calls[0] as [
      { y: number; animated: boolean },
    ];
    expect(arg.animated).toBe(false);
    // Anchored (not negative) and clamped within the scrollable range.
    expect(arg.y).toBeGreaterThanOrEqual(0);
  });

  it("does not scroll on a future day (no now line)", () => {
    setEvents(TOMORROW);

    const { getByTestId } = render(<CalendarView date={TOMORROW} />);
    fireLayout(getByTestId("calendar-scroll"), 600);

    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("scrolls only once even if layout fires repeatedly", () => {
    const { getByTestId } = render(<CalendarView date={TODAY} />);
    const scroll = getByTestId("calendar-scroll");
    fireLayout(scroll, 600);
    fireLayout(scroll, 500);
    fireLayout(scroll, 700);

    expect(scrollToSpy).toHaveBeenCalledTimes(1);
  });
});

describe("CalendarView empty states", () => {
  // Most specific first — no-source was reading as "day is clear", a claim
  // about a calendar this view never read.
  it.each([
    [
      "no source configured",
      { ...READY, notConfigured: true },
      /No calendars yet/,
    ],
    [
      "permission denied",
      { ...READY, permissionDenied: true, notConfigured: true },
      /Calendar access is off/,
    ],
    ["a failed read", { ...READY, isError: true }, /Couldn't load/],
    ["a genuinely clear day", READY, /No events scheduled/],
  ])("says %s", (_label, meta, message) => {
    mockUseCalendarEvents.mockReturnValue([[], meta]);

    const { getByText } = render(<CalendarView date={TODAY} />);

    expect(getByText(message)).toBeTruthy();
  });
});
