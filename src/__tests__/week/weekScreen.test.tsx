import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import type { ComponentProps } from "react";
import { Text, TouchableOpacity } from "react-native";

import WeekScreen from "@/app/(app)/(tabs)/week";
import type { WeekView } from "@/components/WeekView";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import { usePublishViewedDay } from "@/hooks/useViewedDay";
import { weekOf } from "@/utils/weekStartEnd";

jest.mock("@/hooks/useIsLargeDevice", () => ({
  useIsLargeDevice: jest.fn(),
}));
jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/hooks/useViewedDay", () => ({
  usePublishViewedDay: jest.fn(),
}));
// Subscribes to the current day (DEX-161), mocked so a test can move it under
// a mounted screen; the store's own wiring is hooks/useToday.test's.
const mockToday = { current: Temporal.Now.plainDateISO() };
jest.mock("@/hooks/useToday", () => ({ useToday: () => mockToday.current }));

// WeekView is exercised via its own pieces; stub to markers echoing the props
// this route decides, typed off the real component to catch prop renames.
const mockWeekView = ({
  monday,
  onChangeWeek,
  targetDate,
  enableHabits,
  today,
}: ComponentProps<typeof WeekView>) => (
  <>
    <Text>{`week-view:${monday.toString()}`}</Text>
    <Text>{`target:${targetDate.toString()}`}</Text>
    <Text>{`today:${today.toString()}`}</Text>
    <Text>{`habits:${String(enableHabits)}`}</Text>
    <TouchableOpacity
      accessibilityLabel="next-week"
      onPress={() => onChangeWeek(monday.add({ weeks: 1 }))}
    >
      <Text>next</Text>
    </TouchableOpacity>
  </>
);
jest.mock("@/components/WeekView", () => ({
  WeekView: (props: ComponentProps<typeof WeekView>) => mockWeekView(props),
}));

const mockUseIsLargeDevice = useIsLargeDevice as jest.MockedFunction<
  typeof useIsLargeDevice
>;
const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUsePublishViewedDay = usePublishViewedDay as jest.MockedFunction<
  typeof usePublishViewedDay
>;

const preferences = (
  overrides: { enableHabits?: boolean } = {},
): ReturnType<typeof usePreferences> =>
  [
    { enableHabits: true, ...overrides },
    { updatePreferences: jest.fn() },
  ] as never;

const today = Temporal.Now.plainDateISO();
const thisMonday = weekOf(today).monday;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseIsLargeDevice.mockReturnValue(true);
  mockUsePreferences.mockReturnValue(preferences());
  mockToday.current = today;
});

describe("WeekScreen", () => {
  it("opens on the week containing today", () => {
    const screen = render(<WeekScreen />);

    expect(screen.getByText(`week-view:${thisMonday.toString()}`)).toBeTruthy();
  });

  it("pages by whole weeks", () => {
    const screen = render(<WeekScreen />);

    fireEvent.press(screen.getByLabelText("next-week"));

    expect(
      screen.getByText(`week-view:${thisMonday.add({ weeks: 1 }).toString()}`),
    ).toBeTruthy();
  });

  // DEX-161: `monday` was frozen in a `useState` initializer, so an app open
  // across midnight kept last week once the week itself turned over.
  describe("the day changing underneath the screen", () => {
    it("follows the rollover into a new week while this week is on screen", () => {
      const screen = render(<WeekScreen />);

      mockToday.current = thisMonday.add({ weeks: 1 });
      screen.rerender(<WeekScreen />);

      expect(
        screen.getByText(
          `week-view:${thisMonday.add({ weeks: 1 }).toString()}`,
        ),
      ).toBeTruthy();
    });

    it("leaves a week the user paged to alone", () => {
      const screen = render(<WeekScreen />);
      // Two weeks out, so the rollover's own +1 can't be mistaken for staying.
      fireEvent.press(screen.getByLabelText("next-week"));
      fireEvent.press(screen.getByLabelText("next-week"));

      mockToday.current = thisMonday.add({ weeks: 1 });
      screen.rerender(<WeekScreen />);

      expect(
        screen.getByText(
          `week-view:${thisMonday.add({ weeks: 2 }).toString()}`,
        ),
      ).toBeTruthy();
    });

    it("moves the today chip within the week it stays in", () => {
      // A day change inside the same week moves nothing but the day itself —
      // and it has to move, or the chip marks yesterday.
      const screen = render(<WeekScreen />);

      mockToday.current = thisMonday.add({ days: 1 });
      screen.rerender(<WeekScreen />);

      expect(
        screen.getByText(`today:${thisMonday.add({ days: 1 }).toString()}`),
      ).toBeTruthy();
      expect(
        screen.getByText(`week-view:${thisMonday.toString()}`),
      ).toBeTruthy();
    });
  });

  it("passes the habits preference through", () => {
    mockUsePreferences.mockReturnValue(preferences({ enableHabits: false }));
    const screen = render(<WeekScreen />);

    expect(screen.getByText("habits:false")).toBeTruthy();
  });

  describe("the day the create-task entry points target", () => {
    it("is today while today's week is on screen", () => {
      const screen = render(<WeekScreen />);

      expect(screen.getByText(`target:${today.toString()}`)).toBeTruthy();
    });

    it("is the viewed week's Monday once paged away", () => {
      // A task created while looking at another week belongs to the week being
      // looked at, not silently to today.
      const screen = render(<WeekScreen />);

      fireEvent.press(screen.getByLabelText("next-week"));

      expect(
        screen.getByText(`target:${thisMonday.add({ weeks: 1 }).toString()}`),
      ).toBeTruthy();
    });

    it("publishes that day so the create-task modal defaults to it", () => {
      render(<WeekScreen />);

      expect(mockUsePublishViewedDay).toHaveBeenCalledWith(today);
    });

    it("hands WeekView the same day it derived the target from", () => {
      // One clock read for the screen — separate reads let an app open across
      // midnight move the today chip while still scheduling onto yesterday.
      const screen = render(<WeekScreen />);

      expect(screen.getByText(`today:${today.toString()}`)).toBeTruthy();
      expect(screen.getByText(`target:${today.toString()}`)).toBeTruthy();
    });
  });

  describe("below the breakpoint", () => {
    beforeEach(() => {
      mockUseIsLargeDevice.mockReturnValue(false);
    });

    it("explains itself instead of rendering the grid", () => {
      const screen = render(<WeekScreen />);

      expect(screen.queryByText(/^week-view:/)).toBeNull();
      expect(screen.getByText(/needs a wider screen/)).toBeTruthy();
    });

    it("still publishes a viewed day", () => {
      // The tab-bar "+" is reachable from here, so it must not fall back to
      // whatever day another tab last published.
      render(<WeekScreen />);

      expect(mockUsePublishViewedDay).toHaveBeenCalledWith(today);
    });
  });
});
