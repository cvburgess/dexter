import { Temporal } from "@js-temporal/polyfill";
import { fireEvent, render } from "@testing-library/react-native";
import type { ComponentProps } from "react";
import { Text, TouchableOpacity } from "react-native";

import RitualScreen from "@/app/(app)/(tabs)/ritual";
import type { LargeScreenRitual } from "@/components/LargeScreenRitual";
import type { SmallScreenRitual } from "@/components/SmallScreenRitual";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import { usePublishViewedDay } from "@/hooks/useViewedDay";

jest.mock("@/hooks/useIsLargeDevice", () => ({
  useIsLargeDevice: jest.fn(),
}));
jest.mock("@/hooks/useViewedDay", () => ({
  usePublishViewedDay: jest.fn(),
}));
// The screen reads one field. Unmocked, `usePreferences` pulls in `useAuth` and
// a query client, neither of which this route's own behavior depends on.
jest.mock("@/hooks/usePreferences", () => ({
  usePreferences: jest.fn(),
}));
// The screen subscribes to the current day (DEX-161), mocked so a test can
// move it under a mounted screen; mode still comes from the faked clock.
const mockToday = { current: Temporal.PlainDate.from("2026-08-09") };
jest.mock("@/hooks/useToday", () => ({ useToday: () => mockToday.current }));
// The route parses `?date=&step=&n=` (DEX-105); each test names its own params.
const mockUseLocalSearchParams = jest.fn<Record<string, unknown>, []>(
  () => ({}),
);
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

// Both layouts are covered by their own tests; stub to markers echoing state
// plus transition controls, typed off the real components to catch prop renames.
const mockSmallScreenRitual = ({
  state,
  onChangeDate,
  onSelectStep,
  onSwipe,
  onToggleMode,
}: ComponentProps<typeof SmallScreenRitual>) => (
  <>
    <Text>{`small:${state.date.toString()}:${state.mode}:${state.step}:${state.direction}`}</Text>
    <TouchableOpacity
      accessibilityLabel="swipe-forward"
      onPress={() => onSwipe(1)}
    >
      <Text>swipe forward</Text>
    </TouchableOpacity>
    <TouchableOpacity
      accessibilityLabel="swipe-back"
      onPress={() => onSwipe(-1)}
    >
      <Text>swipe back</Text>
    </TouchableOpacity>
    <TouchableOpacity
      accessibilityLabel="pick-last-step"
      onPress={() => onSelectStep(4)}
    >
      <Text>pick</Text>
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
  onSelectStep,
  onSwipe,
}: ComponentProps<typeof LargeScreenRitual>) => (
  <>
    <Text>{`large:${state.date.toString()}:${state.mode}:${state.step}`}</Text>
    <TouchableOpacity
      accessibilityLabel="pick-last-step"
      onPress={() => onSelectStep(4)}
    >
      <Text>pick</Text>
    </TouchableOpacity>
    <TouchableOpacity
      accessibilityLabel="large-swipe-forward"
      onPress={() => onSwipe(1)}
    >
      <Text>swipe</Text>
    </TouchableOpacity>
  </>
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
const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;

// Every preference is named explicitly — an omitted one reads `false` and
// silently shortens the list every assertion below counts against.
const preferences = ({
  enableJournal = true,
  enableCalendar = true,
  enableHoroscope = true,
  // Both rituals have a prompt by default, so the step counts below are the
  // full lists. A list with nothing for one ritual drops only that step.
  templatePrompts = [
    { id: "a", prompt: "Highlight", period: "am" },
    { id: "b", prompt: "What went well?", period: "pm" },
  ],
}: {
  enableJournal?: boolean;
  enableCalendar?: boolean;
  enableHoroscope?: boolean;
  templatePrompts?: { id: string; prompt: string; period: "am" | "pm" }[];
} = {}) =>
  [
    { enableJournal, enableCalendar, enableHoroscope, templatePrompts },
    {},
  ] as unknown as ReturnType<typeof usePreferences>;

const TODAY = "2026-08-09";
const today = Temporal.PlainDate.from(TODAY);
// Local time, not UTC: the screen reads the device's calendar day and hour, so
// a fixed instant has to be pinned in the same zone the code will read it in.
const localTime = (hour: number, day = 9) => new Date(2026, 7, day, hour, 0);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: localTime(9) });
  mockToday.current = today;
  mockUseIsLargeDevice.mockReturnValue(false);
  mockUsePreferences.mockReturnValue(preferences());
  mockUseLocalSearchParams.mockReturnValue({});
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

  // DEX-161: date and mode were frozen in a useState initializer, so an app
  // open across midnight kept offering yesterday's ritual until a force-quit.
  describe("the day changing underneath the screen", () => {
    const TOMORROW = "2026-08-10";

    it("starts the new day's ritual from its first step", () => {
      const screen = render(<RitualScreen />);
      fireEvent.press(screen.getByLabelText("swipe-forward"));

      mockToday.current = today.add({ days: 1 });
      jest.setSystemTime(localTime(9, 10));
      screen.rerender(<RitualScreen />);

      expect(screen.getByText(`small:${TOMORROW}:am:0:0`)).toBeTruthy();
    });

    it("re-derives the mode from the clock rather than carrying it over", () => {
      // Left open in the evening ritual; the mode has to come back from the
      // clock on the new day, not ride along with the old state.
      jest.setSystemTime(localTime(20));
      const screen = render(<RitualScreen />);
      expect(screen.getByText(`small:${TODAY}:pm:0:0`)).toBeTruthy();

      mockToday.current = today.add({ days: 1 });
      jest.setSystemTime(localTime(9, 10));
      screen.rerender(<RitualScreen />);

      expect(screen.getByText(`small:${TOMORROW}:am:0:0`)).toBeTruthy();
    });

    it("leaves a day the user paged to alone", () => {
      const screen = render(<RitualScreen />);
      fireEvent.press(screen.getByLabelText("jump-forward"));

      mockToday.current = today.add({ days: 1 });
      jest.setSystemTime(localTime(9, 10));
      screen.rerender(<RitualScreen />);

      expect(screen.getByText("small:2026-08-12:am:0:1")).toBeTruthy();
    });
  });

  it("publishes the viewed day so the create-task modal defaults to it", () => {
    render(<RitualScreen />);

    expect(mockUsePublishViewedDay).toHaveBeenCalledWith(today);
  });

  it("advances a step, travelling forward", () => {
    const screen = render(<RitualScreen />);

    fireEvent.press(screen.getByLabelText("swipe-forward"));

    expect(screen.getByText(`small:${TODAY}:am:1:1`)).toBeTruthy();
  });

  it("stays put when swiped back from the first step", () => {
    const screen = render(<RitualScreen />);

    fireEvent.press(screen.getByLabelText("swipe-back"));

    expect(screen.getByText(`small:${TODAY}:am:0:0`)).toBeTruthy();
  });

  it("stops at the last step", () => {
    const screen = render(<RitualScreen />);

    // Five morning steps, so the sixth swipe has nowhere to go.
    for (let press = 0; press < 6; press++) {
      fireEvent.press(screen.getByLabelText("swipe-forward"));
    }

    expect(screen.getByText(`small:${TODAY}:am:4:1`)).toBeTruthy();
  });

  // The switcher hands back an index, so a jump can skip several steps at once
  // and still animate the way it travelled.
  it("jumps straight to a picked step", () => {
    const screen = render(<RitualScreen />);

    fireEvent.press(screen.getByLabelText("pick-last-step"));

    expect(screen.getByText(`small:${TODAY}:am:4:1`)).toBeTruthy();
  });

  // DEX-138: the day moves under the step rather than restarting the ritual, so
  // the same question can be asked of another day without walking back to it.
  it("holds the step on another day, animating the way it travelled", () => {
    const screen = render(<RitualScreen />);

    fireEvent.press(screen.getByLabelText("swipe-forward"));
    fireEvent.press(screen.getByLabelText("jump-forward"));

    expect(screen.getByText("small:2026-08-12:am:1:1")).toBeTruthy();
  });

  it("restarts the ritual when the mode is switched", () => {
    const screen = render(<RitualScreen />);

    fireEvent.press(screen.getByLabelText("swipe-forward"));
    fireEvent.press(screen.getByLabelText("toggle-mode"));

    expect(screen.getByText(`small:${TODAY}:pm:0:1`)).toBeTruthy();
  });

  // DEX-105: a journal search result is the only thing that links here.
  describe("a deep link", () => {
    it("opens on the linked day and step from a cold mount", () => {
      // The tab mounts lazily, so the first followed result arrives with
      // params already present — this fails only on the first tap otherwise.
      mockUseLocalSearchParams.mockReturnValue({
        date: "2026-07-12",
        step: "journal",
        n: "1",
      });

      const screen = render(<RitualScreen />);

      // Direction 1: the day jump travels back, then the step jump forward, and
      // the last transition is what the intro animation plays.
      expect(screen.getByText("small:2026-07-12:am:1:1")).toBeTruthy();
    });

    it("follows a link that arrives after mount", () => {
      const screen = render(<RitualScreen />);
      expect(screen.getByText(`small:${TODAY}:am:0:0`)).toBeTruthy();

      mockUseLocalSearchParams.mockReturnValue({
        date: "2026-07-12",
        step: "journal",
        n: "1",
      });
      screen.rerender(<RitualScreen />);

      expect(screen.getByText("small:2026-07-12:am:1:1")).toBeTruthy();
    });

    it("re-applies the same link when it is followed again", () => {
      // The nonce is the only thing separating two taps on one result; without
      // it the second would switch tabs and then do nothing.
      mockUseLocalSearchParams.mockReturnValue({
        date: "2026-07-12",
        step: "journal",
        n: "1",
      });
      const screen = render(<RitualScreen />);

      fireEvent.press(screen.getByLabelText("swipe-forward"));
      expect(screen.getByText("small:2026-07-12:am:2:1")).toBeTruthy();

      mockUseLocalSearchParams.mockReturnValue({
        date: "2026-07-12",
        step: "journal",
        n: "2",
      });
      screen.rerender(<RitualScreen />);

      expect(screen.getByText("small:2026-07-12:am:1:-1")).toBeTruthy();
    });

    it("ignores an unrecognized step rather than blanking the ritual", () => {
      mockUseLocalSearchParams.mockReturnValue({
        date: "2026-07-12",
        step: "not-a-step",
        n: "1",
      });

      const screen = render(<RitualScreen />);

      // The day it named still applies — only the step is dropped.
      expect(screen.getByText("small:2026-07-12:am:0:-1")).toBeTruthy();
    });
  });

  // DEX-151: the journal is per-ritual now. A user who journals only in the
  // morning should not be walked past a question the evening cannot ask.
  describe("with prompts in only one ritual", () => {
    const MORNING_ONLY = [
      { id: "a", prompt: "Highlight", period: "am" as const },
    ];
    const EVENING_ONLY = [
      { id: "b", prompt: "What went well?", period: "pm" as const },
    ];

    it("drops the journal from the evening when it has no prompts of its own", () => {
      mockUsePreferences.mockReturnValue(
        preferences({ templatePrompts: MORNING_ONLY }),
      );
      // Noon or later, so the screen seeds the evening ritual.
      jest.setSystemTime(localTime(13));

      const screen = render(<RitualScreen />);

      // Evening: breathe, open-tasks, review, [journal], preview-tomorrow — so
      // without the journal the fourth step is the last.
      for (let press = 0; press < 4; press++) {
        fireEvent.press(screen.getByLabelText("swipe-forward"));
      }

      expect(screen.getByText(`small:${TODAY}:pm:3:1`)).toBeTruthy();
    });

    it("keeps the journal in the morning when only the evening is empty", () => {
      mockUsePreferences.mockReturnValue(
        preferences({ templatePrompts: MORNING_ONLY }),
      );

      const screen = render(<RitualScreen />);

      // Morning: horoscope, journal, calendar, backlog, summary — unchanged, so
      // the fifth step is still reachable.
      for (let press = 0; press < 4; press++) {
        fireEvent.press(screen.getByLabelText("swipe-forward"));
      }

      expect(screen.getByText(`small:${TODAY}:am:4:1`)).toBeTruthy();
    });

    it("drops the journal from the morning when it has no prompts of its own", () => {
      mockUsePreferences.mockReturnValue(
        preferences({ templatePrompts: EVENING_ONLY }),
      );

      const screen = render(<RitualScreen />);

      // Same shape as turning the preference off: the second step is Calendar.
      fireEvent.press(screen.getByLabelText("swipe-forward"));

      expect(screen.getByText(`small:${TODAY}:am:1:1`)).toBeTruthy();
    });

    // Switching rituals re-asks the question, which is the whole point of
    // deriving the flag from the mode rather than the preference alone.
    it("adds the step back when the user switches to the ritual that has prompts", () => {
      mockUsePreferences.mockReturnValue(
        preferences({ templatePrompts: EVENING_ONLY }),
      );

      const screen = render(<RitualScreen />);

      // Morning has no journal: four steps, so the fourth press does nothing.
      for (let press = 0; press < 4; press++) {
        fireEvent.press(screen.getByLabelText("swipe-forward"));
      }
      expect(screen.getByText(`small:${TODAY}:am:3:1`)).toBeTruthy();

      fireEvent.press(screen.getByLabelText("toggle-mode"));

      // The evening still has its journal, so its list is the full five.
      for (let press = 0; press < 4; press++) {
        fireEvent.press(screen.getByLabelText("swipe-forward"));
      }
      expect(screen.getByText(`small:${TODAY}:pm:4:1`)).toBeTruthy();
    });
  });

  describe("with the journal disabled", () => {
    beforeEach(() => {
      mockUsePreferences.mockReturnValue(preferences({ enableJournal: false }));
    });

    it("drops the journal step, so the second step is Calendar", () => {
      // The step list is a step shorter, so the same index means a different
      // step — the titles themselves are pinned in the ritualSteps tests.
      const screen = render(<RitualScreen />);

      fireEvent.press(screen.getByLabelText("swipe-forward"));

      expect(screen.getByText(`small:${TODAY}:am:1:1`)).toBeTruthy();
    });

    it("stops one step earlier", () => {
      const screen = render(<RitualScreen />);

      for (let press = 0; press < 6; press++) {
        fireEvent.press(screen.getByLabelText("swipe-forward"));
      }

      expect(screen.getByText(`small:${TODAY}:am:3:1`)).toBeTruthy();
    });

    // `usePreferences` serves defaults (journal on) until the row loads, so
    // this is what a cold launch with it disabled actually does.
    it("keeps the user on the same step when the preference arrives late", () => {
      mockUsePreferences.mockReturnValue(preferences());
      const screen = render(<RitualScreen />);

      // Calendar: index 2 with the journal, index 1 without it.
      fireEvent.press(screen.getByLabelText("swipe-forward"));
      fireEvent.press(screen.getByLabelText("swipe-forward"));
      expect(screen.getByText(`small:${TODAY}:am:2:1`)).toBeTruthy();

      mockUsePreferences.mockReturnValue(preferences({ enableJournal: false }));
      screen.rerender(<RitualScreen />);

      expect(screen.getByText(`small:${TODAY}:am:1:0`)).toBeTruthy();
    });

    it("refuses a journal deep link rather than landing somewhere arbitrary", () => {
      mockUseLocalSearchParams.mockReturnValue({
        date: "2026-07-12",
        step: "journal",
        n: "1",
      });

      const screen = render(<RitualScreen />);

      expect(screen.getByText("small:2026-07-12:am:0:-1")).toBeTruthy();
    });
  });

  describe("with the calendar disabled", () => {
    beforeEach(() => {
      mockUsePreferences.mockReturnValue(
        preferences({ enableCalendar: false }),
      );
    });

    it("drops the calendar step, so the third step is Backlog", () => {
      const screen = render(<RitualScreen />);

      fireEvent.press(screen.getByLabelText("swipe-forward"));
      fireEvent.press(screen.getByLabelText("swipe-forward"));

      expect(screen.getByText(`small:${TODAY}:am:2:1`)).toBeTruthy();
    });

    it("stops one step earlier", () => {
      const screen = render(<RitualScreen />);

      for (let press = 0; press < 6; press++) {
        fireEvent.press(screen.getByLabelText("swipe-forward"));
      }

      expect(screen.getByText(`small:${TODAY}:am:3:1`)).toBeTruthy();
    });

    it("leaves the evening ritual, which has no calendar step, alone", () => {
      jest.setSystemTime(localTime(15));
      const screen = render(<RitualScreen />);

      for (let press = 0; press < 6; press++) {
        fireEvent.press(screen.getByLabelText("swipe-forward"));
      }

      expect(screen.getByText(`small:${TODAY}:pm:4:1`)).toBeTruthy();
    });
  });

  describe("with the horoscope disabled", () => {
    beforeEach(() => {
      mockUsePreferences.mockReturnValue(
        preferences({ enableHoroscope: false }),
      );
    });

    // The horoscope is the morning ritual's first step, so this is the one
    // preference that changes where the ritual opens.
    it("drops the horoscope step, so the second step is Calendar", () => {
      const screen = render(<RitualScreen />);

      fireEvent.press(screen.getByLabelText("swipe-forward"));

      expect(screen.getByText(`small:${TODAY}:am:1:1`)).toBeTruthy();
    });

    it("stops one step earlier", () => {
      const screen = render(<RitualScreen />);

      for (let press = 0; press < 6; press++) {
        fireEvent.press(screen.getByLabelText("swipe-forward"));
      }

      expect(screen.getByText(`small:${TODAY}:am:3:1`)).toBeTruthy();
    });

    it("leaves the evening ritual, which has no horoscope step, alone", () => {
      jest.setSystemTime(localTime(15));
      const screen = render(<RitualScreen />);

      for (let press = 0; press < 6; press++) {
        fireEvent.press(screen.getByLabelText("swipe-forward"));
      }

      expect(screen.getByText(`small:${TODAY}:pm:4:1`)).toBeTruthy();
    });

    it("refuses a horoscope deep link rather than landing somewhere arbitrary", () => {
      mockUseLocalSearchParams.mockReturnValue({
        date: "2026-07-12",
        step: "horoscope",
        n: "1",
      });

      const screen = render(<RitualScreen />);

      expect(screen.getByText("small:2026-07-12:am:0:-1")).toBeTruthy();
    });
  });

  // The horoscope defaults *on*, so its late arrival takes a step away like the
  // journal's rather than adding one like the calendar's.
  it("keeps the user on the same step when the horoscope preference arrives late", () => {
    const screen = render(<RitualScreen />);

    // Calendar: index 2 with the horoscope, index 1 without it.
    fireEvent.press(screen.getByLabelText("swipe-forward"));
    fireEvent.press(screen.getByLabelText("swipe-forward"));
    expect(screen.getByText(`small:${TODAY}:am:2:1`)).toBeTruthy();

    mockUsePreferences.mockReturnValue(preferences({ enableHoroscope: false }));
    screen.rerender(<RitualScreen />);

    expect(screen.getByText(`small:${TODAY}:am:1:0`)).toBeTruthy();
  });

  // The calendar preference defaults off, so this runs opposite the journal's
  // late arrival: an enabled user's ritual gains a step after mount.
  it("adds the calendar step when the preference arrives late", () => {
    mockUsePreferences.mockReturnValue(preferences({ enableCalendar: false }));
    const screen = render(<RitualScreen />);

    // Backlog: index 2 without the calendar, index 3 with it.
    fireEvent.press(screen.getByLabelText("swipe-forward"));
    fireEvent.press(screen.getByLabelText("swipe-forward"));
    expect(screen.getByText(`small:${TODAY}:am:2:1`)).toBeTruthy();

    mockUsePreferences.mockReturnValue(preferences());
    screen.rerender(<RitualScreen />);

    expect(screen.getByText(`small:${TODAY}:am:3:0`)).toBeTruthy();
  });

  describe("on a large screen", () => {
    beforeEach(() => {
      mockUseIsLargeDevice.mockReturnValue(true);
    });

    it("renders the wide layout instead of the phone one", () => {
      const screen = render(<RitualScreen />);

      expect(screen.getByText(`large:${TODAY}:am:0`)).toBeTruthy();
      expect(screen.queryByText(/^small:/)).toBeNull();
    });

    // One state serves both layouts — the ritual is the same ritual whatever
    // the window size, which is the point of dropping the separate modal.
    it("drives the same step state as the phone layout", () => {
      const screen = render(<RitualScreen />);

      fireEvent.press(screen.getByLabelText("pick-last-step"));

      expect(screen.getByText(`large:${TODAY}:am:4`)).toBeTruthy();
    });

    // The swipe is wired on both layouts, unlike Today, where only the phone
    // pages by gesture.
    it("advances a step when swiped", () => {
      const screen = render(<RitualScreen />);

      fireEvent.press(screen.getByLabelText("large-swipe-forward"));

      expect(screen.getByText(`large:${TODAY}:am:1`)).toBeTruthy();
    });

    it("still publishes the viewed day", () => {
      render(<RitualScreen />);

      expect(mockUsePublishViewedDay).toHaveBeenCalledWith(today);
    });
  });
});
