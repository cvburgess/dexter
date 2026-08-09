import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import type { ComponentProps } from "react";
import { Text, TouchableOpacity } from "react-native";

import RitualScreen from "@/app/(app)/(tabs)/ritual";
import type { LargeScreenRitual } from "@/components/LargeScreenRitual";
import type { SmallScreenRitual } from "@/components/SmallScreenRitual";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePublishViewedDay } from "@/hooks/useViewedDay";

jest.mock("@/hooks/useIsLargeDevice", () => ({
  useIsLargeDevice: jest.fn(),
}));
jest.mock("@/hooks/useViewedDay", () => ({
  usePublishViewedDay: jest.fn(),
}));

// Both layouts are covered by their own tests; stub them to markers echoing the
// state this route owns, plus controls for driving each transition back through
// it. Typed off the real components so a prop rename fails here rather than
// drifting silently; the `mock` prefix satisfies Jest's hoisting rule.
const mockSmallScreenRitual = ({
  state,
  onChangeDate,
  onNext,
  onSwipe,
  onToggleMode,
}: ComponentProps<typeof SmallScreenRitual>) => (
  <>
    <Text>{`small:${state.date.toString()}:${state.mode}:${state.step}:${state.direction}`}</Text>
    <TouchableOpacity accessibilityLabel="next" onPress={onNext}>
      <Text>next</Text>
    </TouchableOpacity>
    <TouchableOpacity
      accessibilityLabel="swipe-back"
      onPress={() => onSwipe(-1)}
    >
      <Text>swipe back</Text>
    </TouchableOpacity>
    <TouchableOpacity accessibilityLabel="toggle-mode" onPress={onToggleMode}>
      <Text>toggle</Text>
    </TouchableOpacity>
    <TouchableOpacity
      accessibilityLabel="jump-forward"
      onPress={() => onChangeDate(state.date.add({ days: 3 }))}
    >
      <Text>jump</Text>
    </TouchableOpacity>
  </>
);
jest.mock("@/components/SmallScreenRitual", () => ({
  SmallScreenRitual: (props: ComponentProps<typeof SmallScreenRitual>) =>
    mockSmallScreenRitual(props),
}));

const mockLargeScreenRitual = ({
  state,
}: ComponentProps<typeof LargeScreenRitual>) => (
  <Text>{`large:${state.date.toString()}:${state.mode}:${state.step}`}</Text>
);
jest.mock("@/components/LargeScreenRitual", () => ({
  LargeScreenRitual: (props: ComponentProps<typeof LargeScreenRitual>) =>
    mockLargeScreenRitual(props),
}));

const mockUseIsLargeDevice = useIsLargeDevice as jest.MockedFunction<
  typeof useIsLargeDevice
>;
const mockUsePublishViewedDay = usePublishViewedDay as jest.MockedFunction<
  typeof usePublishViewedDay
>;

const TODAY = "2026-08-09";
const today = Temporal.PlainDate.from(TODAY);
// Local time, not UTC: the screen reads the device's calendar day and hour, so
// a fixed instant has to be pinned in the same zone the code will read it in.
const localTime = (hour: number) => new Date(2026, 7, 9, hour, 0);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: localTime(9) });
  mockUseIsLargeDevice.mockReturnValue(false);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("RitualScreen", () => {
  it("opens on today's first step", () => {
    const screen = render(<RitualScreen />);

    expect(screen.getByText(`small:${TODAY}:am:0:0`)).toBeTruthy();
  });

  // The seeding rule itself (noon is the boundary) is pinned in
  // utils/__tests__/ritualSteps.test.ts; this only proves the screen asks.
  it("opens on the evening ritual after noon", () => {
    jest.setSystemTime(localTime(15));
    const screen = render(<RitualScreen />);

    expect(screen.getByText(`small:${TODAY}:pm:0:0`)).toBeTruthy();
  });

  it("publishes the viewed day so the create-task modal defaults to it", () => {
    render(<RitualScreen />);

    expect(mockUsePublishViewedDay).toHaveBeenCalledWith(today);
  });

  it("advances a step, travelling forward", () => {
    const screen = render(<RitualScreen />);

    fireEvent.press(screen.getByLabelText("next"));

    expect(screen.getByText(`small:${TODAY}:am:1:1`)).toBeTruthy();
  });

  it("stays put when swiped back from the first step", () => {
    const screen = render(<RitualScreen />);

    fireEvent.press(screen.getByLabelText("swipe-back"));

    expect(screen.getByText(`small:${TODAY}:am:0:0`)).toBeTruthy();
  });

  it("stops at the last step", () => {
    const screen = render(<RitualScreen />);

    // Six morning steps, so the seventh press has nowhere to go.
    for (let press = 0; press < 7; press++) {
      fireEvent.press(screen.getByLabelText("next"));
    }

    expect(screen.getByText(`small:${TODAY}:am:5:1`)).toBeTruthy();
  });

  it("restarts the ritual on another day, animating the way it travelled", () => {
    const screen = render(<RitualScreen />);

    fireEvent.press(screen.getByLabelText("next"));
    fireEvent.press(screen.getByLabelText("jump-forward"));

    expect(screen.getByText("small:2026-08-12:am:0:1")).toBeTruthy();
  });

  it("restarts the ritual when the mode is switched", () => {
    const screen = render(<RitualScreen />);

    fireEvent.press(screen.getByLabelText("next"));
    fireEvent.press(screen.getByLabelText("toggle-mode"));

    expect(screen.getByText(`small:${TODAY}:pm:0:1`)).toBeTruthy();
  });

  describe("on a large screen", () => {
    beforeEach(() => {
      mockUseIsLargeDevice.mockReturnValue(true);
    });

    it("renders the toolbar layout instead of the step flow", () => {
      const screen = render(<RitualScreen />);

      expect(screen.getByText(`large:${TODAY}:am:0`)).toBeTruthy();
      expect(screen.queryByText(/^small:/)).toBeNull();
    });

    it("still publishes the viewed day", () => {
      render(<RitualScreen />);

      expect(mockUsePublishViewedDay).toHaveBeenCalledWith(today);
    });
  });
});
