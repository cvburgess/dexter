import { Temporal } from "@js-temporal/polyfill";
import { act, fireEvent, render } from "@testing-library/react-native";
import { useEffect } from "react";
import { Text, TouchableOpacity } from "react-native";
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import TodayScreen from "@/app/(app)/(tabs)/today";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { usePreferences } from "@/hooks/usePreferences";
import { useTasks } from "@/hooks/useTasks";
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
jest.mock("@/hooks/useIsLargeDevice", () => ({ useIsLargeDevice: jest.fn() }));
// TodayScreen reads the canonical task cache only to drive the Backlog
// attention dot + the filter tapping Backlog pre-applies (DEX-58); the mocked
// TasksView/TaskDrawer own the real fetch in their own suites. A jest.fn so
// individual tests can inject tasks (its module-scope useAuth import otherwise
// needs the expo-constants manifest this unit test doesn't set up).
jest.mock("@/hooks/useTasks", () => ({ useTasks: jest.fn() }));

const mockPush = jest.fn();
// The `?date=&mode=&q=` deep link the Search tab builds (DEX-47). Mutable so a
// test can set the params before rendering, the way arriving on the route with
// them would.
const mockSearchParams: { current: Record<string, string> } = { current: {} };
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => mockSearchParams.current,
}));

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
// Notes/Calendar read via hooks that need a QueryClientProvider or native
// modules this unit test doesn't mount; their own behavior is covered by their
// own tests. Stub each to a marker exposing its date, plus a mount counter
// (`useEffect` with no deps) — both seed uncontrolled/one-time state from
// `date` at mount (see their own comments) and rely on the host remounting them via a date-keyed `key` for a
// new day to take effect; the large-screen suite below asserts on this count
// to catch a missing `key` (a stale-content bug a marker's `date` prop alone
// can't reveal, since the prop updates fine even without a remount).
const mockNotesViewMount = jest.fn();
const MockNotesView = ({ date }: { date: string }) => {
  useEffect(() => mockNotesViewMount(), []);
  return <Text>notes-view:{date}</Text>;
};
jest.mock("@/components/NotesView", () => ({
  NotesView: (props: Parameters<typeof MockNotesView>[0]) =>
    MockNotesView(props),
}));
const mockCalendarViewMount = jest.fn();
const MockCalendarView = ({ date }: { date: Temporal.PlainDate }) => {
  useEffect(() => mockCalendarViewMount(), []);
  return <Text>calendar-view:{date.toString()}</Text>;
};
jest.mock("@/components/CalendarView", () => ({
  CalendarView: (props: Parameters<typeof MockCalendarView>[0]) =>
    MockCalendarView(props),
}));
// The docked large-screen drawer pane; its own filter/group/search behavior
// is covered by TaskDrawer.test. Stub it to a marker exposing its date, and
// spy on its props so this suite can assert the pane's visibility, toggle
// wiring, and the pre-applied filter.
const mockTaskDrawer = jest.fn(
  ({ date }: { date: Temporal.PlainDate; filterId?: string }) => (
    <Text>task-drawer:{date.toString()}</Text>
  ),
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
    {["tasks", "notes", "calendar"].map((view) => (
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
    enableCalendar: boolean;
    enableHabits: boolean;
  }> = {},
): ReturnType<typeof usePreferences> =>
  [
    {
      enableNotes: true,
      enableCalendar: true,
      enableHabits: true,
      ...overrides,
    },
    { updatePreferences: jest.fn() },
  ] as never;

const mockTogglePane = jest.fn();
const mockOpenPane = jest.fn();
const panes = (
  overrides: Partial<{ drawer: boolean }> = {},
): ReturnType<typeof useTodayPanes> =>
  [
    { drawer: false, ...overrides },
    { togglePane: mockTogglePane, openPane: mockOpenPane, isLoading: false },
  ] as never;

const mockUseIsLargeDevice = useIsLargeDevice as jest.MockedFunction<
  typeof useIsLargeDevice
>;

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const tasksResult = (tasks: TTask[] = []): ReturnType<typeof useTasks> =>
  [tasks, {}] as never;

// An incomplete task whose due date is before today → drives the Overdue
// attention filter. Derived from the real today (the screen filters against it).
const overdueTask = (): TTask => ({
  id: "1",
  alarmTime: null,
  title: "Overdue",
  dueOn: Temporal.Now.plainDateISO().subtract({ days: 1 }).toString(),
  goalId: null,
  listId: null,
  priority: ETaskPriority.UNPRIORITIZED,
  scheduledFor: null,
  status: ETaskStatus.TODO,
  subtasks: [],
  templateId: null,
  url: null,
});

describe("TodayScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.current = {};
    mockUseIsLargeDevice.mockReturnValue(false);
    mockUsePreferences.mockReturnValue(preferences());
    mockUseTodayPanes.mockReturnValue(panes());
    mockUseTasks.mockReturnValue(tasksResult());
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

      // Both arguments reset what a `mode=backlog` deep link may have seeded:
      // this entry point means "show me my backlog", not "show it still narrowed
      // to Unscheduled and filtered by a search from three screens ago"
      // (DEX-47). `"none"`, not `undefined` — `undefined` would leave the
      // seeded Unscheduled filter in place.
      expect(mockPresentTaskDrawer).toHaveBeenCalledWith("none", "");
    });

    it("pre-applies the Overdue filter when opening Backlog with an overdue task", () => {
      mockUseTasks.mockReturnValue(tasksResult([overdueTask()]));
      const screen = render(<TodayScreen />);

      fireEvent.press(screen.getByLabelText("Open task drawer"));

      expect(mockPresentTaskDrawer).toHaveBeenCalledWith("overdue", "");
    });

    it("defaults to the Tasks view", () => {
      const screen = render(<TodayScreen />);

      expect(
        screen.getByText(
          `tasks-view:${Temporal.Now.plainDateISO().toString()}`,
        ),
      ).toBeTruthy();
    });

    it("renders the Calendar view when Calendar is selected", () => {
      const screen = render(<TodayScreen />);

      fireEvent.press(screen.getByLabelText("view-calendar"));

      expect(
        screen.getByText(
          `calendar-view:${Temporal.Now.plainDateISO().toString()}`,
        ),
      ).toBeTruthy();
      expect(screen.queryByText(/^tasks-view:/)).toBeNull();
    });

    it("falls back to Tasks when the selected view is disabled", () => {
      mockUsePreferences.mockReturnValue(
        preferences({ enableCalendar: false }),
      );
      const screen = render(<TodayScreen />);

      fireEvent.press(screen.getByLabelText("view-calendar"));

      expect(screen.queryByText(/^calendar-view:/)).toBeNull();
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
        fireGestureHandler(getByGestureTestId("page-swipe"), [
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
        fireGestureHandler(getByGestureTestId("page-swipe"), [
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
        fireGestureHandler(getByGestureTestId("page-swipe"), [
          { translationX: -200, velocityX: -900 },
        ]);
        fireGestureHandler(getByGestureTestId("page-swipe"), [
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
    beforeEach(() => mockUseIsLargeDevice.mockReturnValue(true));

    it("shows the always-visible Tasks pane plus every enabled pane by default", () => {
      const screen = render(<TodayScreen />);
      const today = Temporal.Now.plainDateISO().toString();

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

    it("pre-applies the attention filter to the docked drawer when the toggle opens it", () => {
      // Stateful pane mock so pressing the toggle actually opens the pane and
      // the docked TaskDrawer renders (the setDrawerFilterId re-render picks up
      // the now-open state).
      let drawerOpen = false;
      mockUseTodayPanes.mockImplementation(
        () =>
          [
            { drawer: drawerOpen },
            {
              togglePane: (pane: string) => {
                if (pane === "drawer") drawerOpen = !drawerOpen;
              },
              isLoading: false,
            },
          ] as never,
      );
      mockUseTasks.mockReturnValue(tasksResult([overdueTask()]));
      const screen = render(<TodayScreen />);

      fireEvent.press(screen.getByLabelText("Toggle task drawer pane"));

      expect(mockTaskDrawer).toHaveBeenLastCalledWith(
        expect.objectContaining({ filterId: "overdue" }),
      );
    });

    it("does not change the drawer filter when the toggle closes the pane", () => {
      mockUseTodayPanes.mockReturnValue(panes({ drawer: true }));
      mockUseTasks.mockReturnValue(tasksResult([overdueTask()]));
      const screen = render(<TodayScreen />);

      // Pane starts open → pressing the toggle closes it; the filter stays at
      // its default rather than jumping to "overdue".
      expect(mockTaskDrawer).toHaveBeenLastCalledWith(
        expect.objectContaining({ filterId: "none" }),
      );

      fireEvent.press(screen.getByLabelText("Toggle task drawer pane"));

      expect(mockTogglePane).toHaveBeenCalledWith("drawer");
    });

    it("does not render the small-screen view switcher", () => {
      const screen = render(<TodayScreen />);

      expect(screen.queryByLabelText("view-tasks")).toBeNull();
    });

    // Settings is the only control over Notes and Calendar since DEX-152 retired
    // the header's pane toggles, so this is the whole of their visibility rule.
    it("hides a pane whose feature is disabled in settings", () => {
      mockUsePreferences.mockReturnValue(
        preferences({ enableCalendar: false }),
      );
      const screen = render(<TodayScreen />);
      const today = Temporal.Now.plainDateISO().toString();

      expect(screen.queryByText(`calendar-view:${today}`)).toBeNull();
      expect(screen.getByText(`notes-view:${today}`)).toBeTruthy();
    });

    it("moves every pane to the next day together via DayNav", () => {
      const screen = render(<TodayScreen />);

      fireEvent.press(screen.getByLabelText("Next day"));

      const tomorrow = Temporal.Now.plainDateISO().add({ days: 1 }).toString();
      expect(screen.getByText(`tasks-view:${tomorrow}`)).toBeTruthy();
      expect(screen.getByText(`notes-view:${tomorrow}`)).toBeTruthy();
      expect(screen.getByText(`calendar-view:${tomorrow}`)).toBeTruthy();
    });

    it("remounts Notes and Calendar on a date change, not just re-rendering them", () => {
      mockNotesViewMount.mockClear();
      mockCalendarViewMount.mockClear();
      const screen = render(<TodayScreen />);
      expect(mockNotesViewMount).toHaveBeenCalledTimes(1);
      expect(mockCalendarViewMount).toHaveBeenCalledTimes(1);

      fireEvent.press(screen.getByLabelText("Next day"));

      // NotesView seeds uncontrolled inputs, and CalendarView
      // seeds its "now" line, only once per mount — a second render with a
      // new `date` prop but the same component instance would leave both
      // showing stale content instead of the new day's.
      expect(mockNotesViewMount).toHaveBeenCalledTimes(2);
      expect(mockCalendarViewMount).toHaveBeenCalledTimes(2);
    });

    it("does not wrap panes in a swipeable day gesture", () => {
      render(<TodayScreen />);

      expect(() => getByGestureTestId("page-swipe")).toThrow();
    });

    it("offers no create button of its own in the header", () => {
      // The nav rail (web) and the tab-bar accessory (native) both carry a
      // "+", so a third one in the header was redundant. Both read the viewed
      // day back through `usePublishViewedDay`/`newTaskRoute`, which the
      // "publishes the viewed day" cases below cover.
      const screen = render(<TodayScreen />);

      expect(screen.queryByLabelText("New Task")).toBeNull();
    });
  });

  // DEX-47: the `?date=&mode=&q=` deep link the Search tab builds. The link
  // format itself is unit-tested in utils/__tests__/todayRoute.test.ts; these
  // cover what this screen does on arrival.
  describe("search deep links", () => {
    it("opens the day named by ?date= instead of today", () => {
      mockSearchParams.current = { date: "2026-07-14" };

      const screen = render(<TodayScreen />);

      expect(screen.getByText("tasks-view:2026-07-14")).toBeTruthy();
      // The viewed day drives New Task's default schedule too, so a deep link
      // has to publish the day it landed on, not the real today.
      expect(lastPublishedDay()).toBe("2026-07-14");
    });

    it("falls back to today when ?date= is unparseable", () => {
      // The route is linkable on web, so a hand-edited or stale URL is a real
      // source of garbage — it must not crash the tab.
      mockSearchParams.current = { date: "2026-02-30" };

      const screen = render(<TodayScreen />);

      expect(
        screen.getByText(
          `tasks-view:${Temporal.Now.plainDateISO().toString()}`,
        ),
      ).toBeTruthy();
    });

    it("selects the view named by ?mode=", () => {
      mockSearchParams.current = { date: "2026-07-14", mode: "notes" };

      const screen = render(<TodayScreen />);

      expect(screen.getByText("notes-view:2026-07-14")).toBeTruthy();
    });

    it("ignores an unrecognized ?mode= rather than blanking the day", () => {
      mockSearchParams.current = { date: "2026-07-14", mode: "nonsense" };

      const screen = render(<TodayScreen />);

      expect(screen.getByText("tasks-view:2026-07-14")).toBeTruthy();
    });

    // A stale link from before DEX-105, when the journal was a day view. It has
    // to fall through to Tasks rather than select a view that no longer exists.
    it("ignores a stale ?mode=journal", () => {
      mockSearchParams.current = { date: "2026-07-14", mode: "journal" };

      const screen = render(<TodayScreen />);

      expect(screen.getByText("tasks-view:2026-07-14")).toBeTruthy();
    });

    it("opens the backlog sheet pre-filtered and pre-searched", () => {
      // An unscheduled task has no day to open, so the link points at the
      // drawer instead — seeded so the task the user tapped is on screen
      // straight away rather than somewhere in the backlog.
      mockSearchParams.current = { mode: "backlog", q: "quarterly" };

      render(<TodayScreen />);

      expect(mockPresentTaskDrawer).toHaveBeenCalledWith(
        "unscheduled",
        "quarterly",
      );
    });

    it("does not touch the drawer without a backlog link", () => {
      render(<TodayScreen />);

      expect(mockPresentTaskDrawer).not.toHaveBeenCalled();
    });

    it("re-applies a link the user has since navigated away from", () => {
      // The real regression this guards: cross-tab navigation reuses this
      // mounted screen and only swaps its params, so tapping a result, moving to
      // another day, and tapping the *same* result again produces identical
      // date/mode values. Without the per-navigation `n`, the second tap would
      // switch tabs and then do nothing.
      mockSearchParams.current = { date: "2026-07-14", mode: "tasks", n: "1" };
      const screen = render(<TodayScreen />);
      expect(screen.getByText("tasks-view:2026-07-14")).toBeTruthy();

      // The user pages forward a day themselves.
      fireEvent.press(screen.getByLabelText("Next day"));
      expect(screen.getByText("tasks-view:2026-07-15")).toBeTruthy();

      // Same result tapped again — only `n` differs.
      mockSearchParams.current = { date: "2026-07-14", mode: "tasks", n: "2" };
      screen.rerender(<TodayScreen />);

      expect(screen.getByText("tasks-view:2026-07-14")).toBeTruthy();
    });

    it("does not drag the user back to the link's day on an unrelated re-render", () => {
      mockSearchParams.current = { date: "2026-07-14", mode: "tasks", n: "1" };
      const screen = render(<TodayScreen />);
      fireEvent.press(screen.getByLabelText("Next day"));

      // Same params, no new navigation.
      screen.rerender(<TodayScreen />);

      expect(screen.getByText("tasks-view:2026-07-15")).toBeTruthy();
    });

    it("re-presents the backlog sheet when the same result is tapped again", () => {
      mockSearchParams.current = { mode: "backlog", q: "quarterly", n: "1" };
      const screen = render(<TodayScreen />);
      expect(mockPresentTaskDrawer).toHaveBeenCalledTimes(1);

      // The user dismissed the sheet and tapped the same result again.
      mockSearchParams.current = { mode: "backlog", q: "quarterly", n: "2" };
      screen.rerender(<TodayScreen />);

      expect(mockPresentTaskDrawer).toHaveBeenCalledTimes(2);
    });

    it("still selects the view when the day is left implicit", () => {
      mockSearchParams.current = { mode: "notes" };

      const screen = render(<TodayScreen />);

      expect(
        screen.getByText(
          `notes-view:${Temporal.Now.plainDateISO().toString()}`,
        ),
      ).toBeTruthy();
    });

    describe("large screens", () => {
      beforeEach(() => mockUseIsLargeDevice.mockReturnValue(true));

      it("lands on the pane named by ?mode= without opening anything", () => {
        mockSearchParams.current = { date: "2026-07-14", mode: "notes" };

        const screen = render(<TodayScreen />);

        // Notes shows whenever it is enabled in settings (DEX-152), so a link
        // naming it has already arrived — there is no pane state left to write.
        expect(screen.getByText("notes-view:2026-07-14")).toBeTruthy();
        expect(mockOpenPane).not.toHaveBeenCalled();
      });

      it("opens the docked drawer pre-filtered and pre-searched", () => {
        mockUseTodayPanes.mockReturnValue(panes({ drawer: true }));
        mockSearchParams.current = { mode: "backlog", q: "quarterly" };

        render(<TodayScreen />);

        expect(mockOpenPane).toHaveBeenCalledWith("drawer");
        expect(mockTaskDrawer).toHaveBeenCalledWith(
          expect.objectContaining({
            filterId: "unscheduled",
            search: "quarterly",
          }),
        );
      });

      it("clears a deep link's seeded filter when the header reopens the drawer", () => {
        // The header's Backlog action means "show me my backlog". Without this
        // it inherited the link's Unscheduled filter and showed only a slice of
        // it — the search was cleared but the filter was not.
        mockUseTodayPanes.mockReturnValue(panes({ drawer: true }));
        mockSearchParams.current = { mode: "backlog", q: "quarterly", n: "1" };
        const screen = render(<TodayScreen />);
        expect(mockTaskDrawer).toHaveBeenLastCalledWith(
          expect.objectContaining({
            filterId: "unscheduled",
            search: "quarterly",
          }),
        );

        // Close, then reopen from the header with nothing needing attention.
        fireEvent.press(screen.getByLabelText("Toggle task drawer pane"));
        mockUseTodayPanes.mockReturnValue(panes({ drawer: false }));
        screen.rerender(<TodayScreen />);
        mockUseTodayPanes.mockReturnValue(panes({ drawer: true }));
        fireEvent.press(screen.getByLabelText("Toggle task drawer pane"));
        screen.rerender(<TodayScreen />);

        expect(mockTaskDrawer).toHaveBeenLastCalledWith(
          expect.objectContaining({ filterId: "none", search: "" }),
        );
      });

      it("leaves the panes and the tab alone without a mode", () => {
        const screen = render(<TodayScreen />);

        expect(mockOpenPane).not.toHaveBeenCalled();
        expect(
          screen.getByText(
            `notes-view:${Temporal.Now.plainDateISO().toString()}`,
          ),
        ).toBeTruthy();
      });
    });
  });
});
