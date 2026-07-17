import { Temporal } from "@js-temporal/polyfill";
import { act, fireEvent, render } from "@testing-library/react-native";
import { useEffect } from "react";
import { Text, TouchableOpacity } from "react-native";
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils";

import TodayScreen from "@/app/(app)/(tabs)/today";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import { usePreferences } from "@/hooks/usePreferences";
import { useTodayPanes } from "@/hooks/useTodayPanes";
import { usePublishViewedDay } from "@/hooks/useViewedDay";

// usePublishViewedDay uses expo-router's useFocusEffect, which needs a
// navigation container this unit test doesn't mount; assert the wiring instead.
jest.mock("@/hooks/useViewedDay", () => ({ usePublishViewedDay: jest.fn() }));
const mockPublishViewedDay = usePublishViewedDay as jest.MockedFunction<
  typeof usePublishViewedDay
>;

jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
jest.mock("@/hooks/useTodayPanes", () => ({ useTodayPanes: jest.fn() }));
jest.mock("@/hooks/useIsMultiPane", () => ({ useIsMultiPane: jest.fn() }));
// TodayScreen reads the canonical task cache only to drive the Backlog
// attention dot (DEX-58); the mocked TasksView/TaskDrawer own the real fetch in
// their own suites. Stub it to an empty list (its module-scope useAuth import
// otherwise needs the expo-constants manifest this unit test doesn't set up).
jest.mock("@/hooks/useTasks", () => ({ useTasks: () => [[], {}] }));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

// The always-visible Tasks pane owns its own data fetching (see
// TasksView.test); stub it to a marker exposing the date it was given so this
// suite can assert day-navigation wiring without a QueryClientProvider.
const mockTasksView = ({ date }: { date: Temporal.PlainDate }) => (
  <Text>tasks-view:{date.toString()}</Text>
);
jest.mock("@/components/TasksView", () => ({
  TasksView: (props: Parameters<typeof mockTasksView>[0]) =>
    mockTasksView(props),
}));
// Notes/Journal/Calendar read via hooks that need a QueryClientProvider or
// native modules this unit test doesn't mount; their own behavior is covered
// by their own tests. Stub each to a marker exposing its date, plus a mount
// counter (`useEffect` with no deps) — NotesView/JournalView/CalendarView all
// seed uncontrolled/one-time state from `date` at mount (see their own
// comments) and rely on the host remounting them via a date-keyed `key` for a
// new day to take effect; the large-screen suite below asserts on this count
// to catch a missing `key` (a stale-content bug a marker's `date` prop alone
// can't reveal, since the prop updates fine even without a remount).
const mockNotesViewMount = jest.fn();
const mockNotesView = ({ date }: { date: string }) => {
  useEffect(() => mockNotesViewMount(), []);
  return <Text>notes-view:{date}</Text>;
};
jest.mock("@/components/NotesView", () => ({
  NotesView: (props: Parameters<typeof mockNotesView>[0]) =>
    mockNotesView(props),
}));
const mockJournalView = ({ date }: { date: string }) => (
  <Text>journal-view:{date}</Text>
);
jest.mock("@/components/JournalView", () => ({
  JournalView: (props: Parameters<typeof mockJournalView>[0]) =>
    mockJournalView(props),
}));
const mockCalendarViewMount = jest.fn();
const mockCalendarView = ({ date }: { date: Temporal.PlainDate }) => {
  useEffect(() => mockCalendarViewMount(), []);
  return <Text>calendar-view:{date.toString()}</Text>;
};
jest.mock("@/components/CalendarView", () => ({
  CalendarView: (props: Parameters<typeof mockCalendarView>[0]) =>
    mockCalendarView(props),
}));
// The docked large-screen drawer pane; its own filter/group/search behavior
// is covered by TaskDrawer.test. Stub it to a marker exposing its date so
// this suite can assert the pane's visibility and toggle wiring.
const mockTaskDrawer = ({ date }: { date: Temporal.PlainDate }) => (
  <Text>task-drawer:{date.toString()}</Text>
);
jest.mock("@/components/TaskDrawer", () => ({
  TaskDrawer: (props: Parameters<typeof mockTaskDrawer>[0]) =>
    mockTaskDrawer(props),
}));
// The mobile sheet shell hosts a native `@expo/ui` bottom sheet that can't be
// driven from a unit test; stub it to a marker exposing its date, and fake the
// imperative ref so pressing the drawer action can be asserted.
const mockPresentTaskDrawer = jest.fn();
const mockTaskDrawerSheet = ({
  ref,
  date,
}: {
  ref?: { current: unknown };
  date: Temporal.PlainDate;
}) => {
  if (ref) ref.current = { present: mockPresentTaskDrawer };
  return <Text>task-drawer-sheet:{date.toString()}</Text>;
};
jest.mock("@/components/TaskDrawerSheet", () => ({
  TaskDrawerSheet: (props: Parameters<typeof mockTaskDrawerSheet>[0]) =>
    mockTaskDrawerSheet(props),
}));

// The real switcher is an icon-only native trigger (GlassIconButton + IconMenu),
// so it can't be driven from a unit test. Stub it with a plain button per view
// that calls onChangeView, plus a button for the drawer action (onOpenDrawer),
// letting tests exercise the small-screen view branches and the drawer trigger.
// The switcher's own gating is covered by DayViewSwitcher.test.
const mockDayViewSwitcher = ({
  onChangeView,
  onOpenDrawer,
}: {
  onChangeView: (view: string) => void;
  onOpenDrawer?: () => void;
}) => (
  <>
    {["tasks", "notes", "journal"].map((view) => (
      <TouchableOpacity
        accessibilityLabel={`view-${view}`}
        key={view}
        onPress={() => onChangeView(view)}
      >
        <Text>{view}</Text>
      </TouchableOpacity>
    ))}
    {onOpenDrawer && (
      <TouchableOpacity
        accessibilityLabel="Open task drawer"
        onPress={onOpenDrawer}
      >
        <Text>Open task drawer</Text>
      </TouchableOpacity>
    )}
  </>
);
jest.mock("@/components/DayViewSwitcher", () => ({
  DayViewSwitcher: (props: Parameters<typeof mockDayViewSwitcher>[0]) =>
    mockDayViewSwitcher(props),
}));
// The large-screen pane toggles wrap the same native trigger; stub similarly,
// gated on the enable* props like the real component. Its own gating/wiring
// is covered by DayPaneToggles.test.
const mockDayPaneToggles = ({
  onTogglePane,
  enableNotes,
  enableJournal,
  enableCalendar,
}: {
  onTogglePane: (pane: string) => void;
  enableNotes: boolean;
  enableJournal: boolean;
  enableCalendar: boolean;
}) => (
  <>
    {enableNotes && (
      <TouchableOpacity
        accessibilityLabel="pane-toggle-notes"
        onPress={() => onTogglePane("notes")}
      >
        <Text>notes</Text>
      </TouchableOpacity>
    )}
    {enableJournal && (
      <TouchableOpacity
        accessibilityLabel="pane-toggle-journal"
        onPress={() => onTogglePane("journal")}
      >
        <Text>journal</Text>
      </TouchableOpacity>
    )}
    {enableCalendar && (
      <TouchableOpacity
        accessibilityLabel="pane-toggle-calendar"
        onPress={() => onTogglePane("calendar")}
      >
        <Text>calendar</Text>
      </TouchableOpacity>
    )}
  </>
);
jest.mock("@/components/DayPaneToggles", () => ({
  DayPaneToggles: (props: Parameters<typeof mockDayPaneToggles>[0]) =>
    mockDayPaneToggles(props),
}));
// The header's "New Task" trigger wraps the same native circular button; stub
// it so it renders as a plain pressable exposing its a11y label.
const mockGlassIconButton = ({
  accessibilityLabel,
  onPress,
}: {
  accessibilityLabel: string;
  onPress?: () => void;
}) => (
  <TouchableOpacity accessibilityLabel={accessibilityLabel} onPress={onPress}>
    <Text>{accessibilityLabel}</Text>
  </TouchableOpacity>
);
jest.mock("@/components/GlassIconButton", () => ({
  GlassIconButton: (props: Parameters<typeof mockGlassIconButton>[0]) =>
    mockGlassIconButton(props),
}));

const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;
const mockUseTodayPanes = useTodayPanes as jest.MockedFunction<
  typeof useTodayPanes
>;

const preferences = (
  overrides: Partial<{
    enableNotes: boolean;
    enableJournal: boolean;
    enableCalendar: boolean;
    enableHabits: boolean;
  }> = {},
): ReturnType<typeof usePreferences> =>
  [
    {
      enableNotes: true,
      enableJournal: true,
      enableCalendar: true,
      enableHabits: true,
      ...overrides,
    },
    { updatePreferences: jest.fn() },
  ] as never;

const mockTogglePane = jest.fn();
const panes = (
  overrides: Partial<{
    notes: boolean;
    journal: boolean;
    calendar: boolean;
    drawer: boolean;
  }> = {},
): ReturnType<typeof useTodayPanes> =>
  [
    {
      notes: true,
      journal: true,
      calendar: true,
      drawer: false,
      ...overrides,
    },
    { togglePane: mockTogglePane, isLoading: false },
  ] as never;

const mockUseIsMultiPane = useIsMultiPane as jest.MockedFunction<
  typeof useIsMultiPane
>;

describe("TodayScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsMultiPane.mockReturnValue(false);
    mockUsePreferences.mockReturnValue(preferences());
    mockUseTodayPanes.mockReturnValue(panes());
  });

  const lastPublishedDay = () =>
    mockPublishViewedDay.mock.calls.at(-1)?.[0]?.toString();

  it("publishes the viewed day so New Task defaults its schedule to it", () => {
    render(<TodayScreen />);

    expect(lastPublishedDay()).toBe(Temporal.Now.plainDateISO().toString());
  });

  it("publishes the new day after navigating a day forward", () => {
    const screen = render(<TodayScreen />);

    fireEvent.press(screen.getByLabelText("Next day"));

    expect(lastPublishedDay()).toBe(
      Temporal.Now.plainDateISO().add({ days: 1 }).toString(),
    );
  });

  describe("small screens", () => {
    it("mounts the task drawer sheet for the viewed day", () => {
      const screen = render(<TodayScreen />);

      expect(
        screen.getByText(
          `task-drawer-sheet:${Temporal.Now.plainDateISO().toString()}`,
        ),
      ).toBeTruthy();
    });

    it("opens the task drawer sheet from the view switcher's drawer action", () => {
      const screen = render(<TodayScreen />);

      fireEvent.press(screen.getByLabelText("Open task drawer"));

      expect(mockPresentTaskDrawer).toHaveBeenCalled();
    });

    it("defaults to the Tasks view", () => {
      const screen = render(<TodayScreen />);

      expect(
        screen.getByText(
          `tasks-view:${Temporal.Now.plainDateISO().toString()}`,
        ),
      ).toBeTruthy();
    });

    it("renders the Journal view when Journal is selected", () => {
      const screen = render(<TodayScreen />);

      fireEvent.press(screen.getByLabelText("view-journal"));

      expect(
        screen.getByText(
          `journal-view:${Temporal.Now.plainDateISO().toString()}`,
        ),
      ).toBeTruthy();
      expect(screen.queryByText(/^tasks-view:/)).toBeNull();
    });

    it("falls back to Tasks when Journal is selected but disabled", () => {
      mockUsePreferences.mockReturnValue(preferences({ enableJournal: false }));
      const screen = render(<TodayScreen />);

      fireEvent.press(screen.getByLabelText("view-journal"));

      expect(screen.queryByText(/^journal-view:/)).toBeNull();
      expect(
        screen.getByText(
          `tasks-view:${Temporal.Now.plainDateISO().toString()}`,
        ),
      ).toBeTruthy();
    });

    it("re-renders the Tasks pane for the new date after navigating a day forward", () => {
      const screen = render(<TodayScreen />);

      fireEvent.press(screen.getByLabelText("Next day"));

      expect(
        screen.getByText(
          `tasks-view:${Temporal.Now.plainDateISO()
            .add({ days: 1 })
            .toString()}`,
        ),
      ).toBeTruthy();
    });

    it("re-renders the Tasks pane for the next day after swiping left", () => {
      const screen = render(<TodayScreen />);

      act(() => {
        fireGestureHandler(getByGestureTestId("day-swipe"), [
          { translationX: -200, velocityX: -900 },
        ]);
      });

      expect(
        screen.getByText(
          `tasks-view:${Temporal.Now.plainDateISO()
            .add({ days: 1 })
            .toString()}`,
        ),
      ).toBeTruthy();
    });

    it("re-renders the Tasks pane for the previous day after swiping right", () => {
      const screen = render(<TodayScreen />);

      act(() => {
        fireGestureHandler(getByGestureTestId("day-swipe"), [
          { translationX: 200, velocityX: 900 },
        ]);
      });

      expect(
        screen.getByText(
          `tasks-view:${Temporal.Now.plainDateISO()
            .subtract({ days: 1 })
            .toString()}`,
        ),
      ).toBeTruthy();
    });

    it("advances two days when two swipes fire before a re-render settles", () => {
      const screen = render(<TodayScreen />);

      act(() => {
        fireGestureHandler(getByGestureTestId("day-swipe"), [
          { translationX: -200, velocityX: -900 },
        ]);
        fireGestureHandler(getByGestureTestId("day-swipe"), [
          { translationX: -200, velocityX: -900 },
        ]);
      });

      expect(
        screen.getByText(
          `tasks-view:${Temporal.Now.plainDateISO()
            .add({ days: 2 })
            .toString()}`,
        ),
      ).toBeTruthy();
    });
  });

  describe("large screens (multi-pane)", () => {
    beforeEach(() => mockUseIsMultiPane.mockReturnValue(true));

    it("shows the always-visible Tasks pane plus every enabled pane by default", () => {
      const screen = render(<TodayScreen />);
      const today = Temporal.Now.plainDateISO().toString();

      // Notes/Journal share one tabbed pane (see NotesJournalTabs.test) and
      // default to the Notes tab.
      expect(screen.getByText(`tasks-view:${today}`)).toBeTruthy();
      expect(screen.getByText(`notes-view:${today}`)).toBeTruthy();
      expect(screen.getByText(`calendar-view:${today}`)).toBeTruthy();
    });

    it("hides the task drawer pane by default", () => {
      const screen = render(<TodayScreen />);

      expect(screen.queryByText(/^task-drawer:/)).toBeNull();
    });

    it("shows the task drawer pane for the viewed day once opened", () => {
      mockUseTodayPanes.mockReturnValue(panes({ drawer: true }));
      const screen = render(<TodayScreen />);
      const today = Temporal.Now.plainDateISO().toString();

      expect(screen.getByText(`task-drawer:${today}`)).toBeTruthy();
    });

    it("toggles the task drawer pane via its header button", () => {
      const screen = render(<TodayScreen />);

      fireEvent.press(screen.getByLabelText("Toggle task drawer pane"));

      expect(mockTogglePane).toHaveBeenCalledWith("drawer");
    });

    it("does not render the small-screen view switcher", () => {
      const screen = render(<TodayScreen />);

      expect(screen.queryByLabelText("view-tasks")).toBeNull();
    });

    it("hides a pane whose feature is disabled in settings, and hides its toggle", () => {
      mockUsePreferences.mockReturnValue(
        preferences({ enableCalendar: false }),
      );
      const screen = render(<TodayScreen />);
      const today = Temporal.Now.plainDateISO().toString();

      expect(screen.queryByText(`calendar-view:${today}`)).toBeNull();
      expect(screen.queryByLabelText("pane-toggle-calendar")).toBeNull();
    });

    it("switches the combined pane to Journal when Notes is toggled off", () => {
      mockUseTodayPanes.mockReturnValue(panes({ notes: false }));
      const screen = render(<TodayScreen />);
      const today = Temporal.Now.plainDateISO().toString();

      expect(screen.queryByText(`notes-view:${today}`)).toBeNull();
      expect(screen.getByText(`journal-view:${today}`)).toBeTruthy();
    });

    it("hides the combined Notes/Journal pane when both are toggled off", () => {
      mockUseTodayPanes.mockReturnValue(
        panes({ notes: false, journal: false }),
      );
      const screen = render(<TodayScreen />);
      const today = Temporal.Now.plainDateISO().toString();

      expect(screen.queryByText(`notes-view:${today}`)).toBeNull();
      expect(screen.queryByText(`journal-view:${today}`)).toBeNull();
      expect(screen.getByText(`calendar-view:${today}`)).toBeTruthy();
    });

    it("toggles a pane via its header button", () => {
      const screen = render(<TodayScreen />);

      fireEvent.press(screen.getByLabelText("pane-toggle-journal"));

      expect(mockTogglePane).toHaveBeenCalledWith("journal");
    });

    it("moves every pane to the next day together via DayNav", () => {
      const screen = render(<TodayScreen />);

      fireEvent.press(screen.getByLabelText("Next day"));

      const tomorrow = Temporal.Now.plainDateISO().add({ days: 1 }).toString();
      expect(screen.getByText(`tasks-view:${tomorrow}`)).toBeTruthy();
      expect(screen.getByText(`notes-view:${tomorrow}`)).toBeTruthy();
      expect(screen.getByText(`calendar-view:${tomorrow}`)).toBeTruthy();
    });

    it("remounts Notes/Journal and Calendar on a date change, not just re-rendering them", () => {
      mockNotesViewMount.mockClear();
      mockCalendarViewMount.mockClear();
      const screen = render(<TodayScreen />);
      expect(mockNotesViewMount).toHaveBeenCalledTimes(1);
      expect(mockCalendarViewMount).toHaveBeenCalledTimes(1);

      fireEvent.press(screen.getByLabelText("Next day"));

      // NotesView/JournalView seed uncontrolled inputs, and CalendarView
      // seeds its "now" line, only once per mount — a second render with a
      // new `date` prop but the same component instance would leave both
      // showing stale content instead of the new day's.
      expect(mockNotesViewMount).toHaveBeenCalledTimes(2);
      expect(mockCalendarViewMount).toHaveBeenCalledTimes(2);
    });

    it("does not wrap panes in a swipeable day gesture", () => {
      render(<TodayScreen />);

      expect(() => getByGestureTestId("day-swipe")).toThrow();
    });

    it("opens the new-task modal scheduled for the viewed day", () => {
      const screen = render(<TodayScreen />);

      fireEvent.press(screen.getByLabelText("New Task"));

      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/new-task",
        params: { scheduledFor: Temporal.Now.plainDateISO().toString() },
      });
    });
  });
});
