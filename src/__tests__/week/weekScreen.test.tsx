import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import { Text, TouchableOpacity } from "react-native";

import WeekScreen from "@/app/(app)/(tabs)/week";
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

// WeekView is exercised through its own pieces (WeekNav/WeekDayColumn tests);
// stub it to a marker that echoes the props this route decides — which week is
// on screen, and which day the "+" entry points target — plus a control for
// driving week changes back through the route's own state.
const mockWeekView = jest.fn(
  ({
    monday,
    onChangeWeek,
    targetDate,
    enableHabits,
  }: {
    monday: Temporal.PlainDate;
    onChangeWeek: (next: Temporal.PlainDate) => void;
    targetDate: Temporal.PlainDate;
    enableHabits: boolean;
  }) => (
    <>
      <Text>{`week-view:${monday.toString()}`}</Text>
      <Text>{`target:${targetDate.toString()}`}</Text>
      <Text>{`habits:${String(enableHabits)}`}</Text>
      <TouchableOpacity
        accessibilityLabel="next-week"
        onPress={() => onChangeWeek(monday.add({ weeks: 1 }))}
      >
        <Text>next</Text>
      </TouchableOpacity>
    </>
  ),
);
jest.mock("@/components/WeekView", () => ({
  WeekView: (props: Parameters<typeof mockWeekView>[0]) => mockWeekView(props),
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
