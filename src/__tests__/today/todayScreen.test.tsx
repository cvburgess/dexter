import { Temporal } from "@js-temporal/polyfill";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Text, TouchableOpacity } from "react-native";
import {
  fireGestureHandler,
  getByGestureTestId,
} from "react-native-gesture-handler/jest-utils";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";

import TodayScreen from "@/app/(app)/(tabs)/today";
import { usePreferences } from "@/hooks/usePreferences";
import { taskFiltersForDate, useTasks } from "@/hooks/useTasks";
import { usePublishViewedDay } from "@/hooks/useViewedDay";

// usePublishViewedDay uses expo-router's useFocusEffect, which needs a
// navigation container this unit test doesn't mount; assert the wiring instead.
jest.mock("@/hooks/useViewedDay", () => ({ usePublishViewedDay: jest.fn() }));
const mockPublishViewedDay = usePublishViewedDay as jest.MockedFunction<
  typeof usePublishViewedDay
>;

// useTasks imports the supabase client from useAuth, which reads the app's
// URI scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useTasks", () => ({
  ...jest.requireActual("@/hooks/useTasks"),
  useTasks: jest.fn(),
  // The screen renders without a QueryClientProvider, so the real
  // prefetch hook's useQueryClient() would throw.
  usePrefetchAdjacentTasks: jest.fn(),
}));
jest.mock("@/hooks/useLists", () => ({
  useLists: () => [
    [],
    {
      createList: jest.fn(),
      deleteList: jest.fn(),
      updateList: jest.fn(),
      getListById: () => undefined,
    },
  ],
}));
// The task menu (via TaskCard/MoreMenu) reads templates and expo-router; both
// would otherwise need a QueryClientProvider / navigation container this unit
// test doesn't mount.
jest.mock("@/hooks/useTemplates", () => ({
  useTemplates: () => [
    [],
    {
      createTemplate: jest.fn(),
      createTemplateFromTask: jest.fn(),
      deleteTemplate: jest.fn(),
      getTemplateById: () => undefined,
      isLoading: false,
      updateTemplate: jest.fn(),
    },
  ],
}));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
// The habit tracker is exercised on its own; stub it here so this suite stays
// focused on task rendering (and so its expo-router import isn't evaluated).
jest.mock("@/components/HabitTracker", () => ({ HabitTracker: () => null }));
// usePreferences reads via useQuery, which would throw without a
// QueryClientProvider (this screen mounts without one). A jest.fn() so tests can
// vary the enabled views (e.g. Journal on/off).
jest.mock("@/hooks/usePreferences", () => ({ usePreferences: jest.fn() }));
// The Notes view's editor wraps a native module (react-native-enriched-markdown)
// with no Jest double; stub it so the module graph loads. The Notes surface is
// covered by NotesView.test; this suite stays focused on the Tasks view.
jest.mock("@/components/NoteEditor", () => ({ NoteEditor: () => null }));
// The Journal view reads via useDays (supabase/QueryClient); stub it to a marker
// so this suite can assert it mounts when Journal is selected. Its behavior is
// covered by JournalView.test.
const mockJournalView = () => <Text>journal-view</Text>;
jest.mock("@/components/JournalView", () => ({
  JournalView: () => mockJournalView(),
}));
// The real switcher is an icon-only native trigger (GlassIconButton + IconMenu),
// so it can't be driven from a unit test. Stub it with a plain button per view
// that calls onChangeView, letting tests exercise the screen's view branches.
// The switcher's own gating is covered by DayViewSwitcher.test.
const mockDayViewSwitcher = ({
  onChangeView,
}: {
  onChangeView: (view: string) => void;
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
  </>
);
jest.mock("@/components/DayViewSwitcher", () => ({
  DayViewSwitcher: (props: { onChangeView: (view: string) => void }) =>
    mockDayViewSwitcher(props),
}));
// The view switcher's circular button wraps native glass/SF-symbol views; stub
// it so the icon-only trigger renders without them (covered by its own tests).
jest.mock("@/components/GlassIconButton", () => ({
  GlassIconButton: () => null,
}));

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockUsePreferences = usePreferences as jest.MockedFunction<
  typeof usePreferences
>;

const task: TTask = {
  id: "task-1",
  title: "Write the report",
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.URGENT,
  scheduledFor: "2026-07-03",
  status: ETaskStatus.TODO,
  templateId: null,
};

const preferences = (
  overrides: { enableJournal?: boolean } = {},
): ReturnType<typeof usePreferences> =>
  [
    {
      enableHabits: true,
      enableNotes: true,
      enableJournal: true,
      ...overrides,
    },
    { updatePreferences: jest.fn() },
  ] as never;

describe("TodayScreen", () => {
  beforeEach(() => {
    mockUseTasks.mockReturnValue([
      [],
      {
        createTask: jest.fn(),
        deleteTask: jest.fn(),
        isLoading: false,
        updateTask: jest.fn(),
        updateTasks: jest.fn(),
      },
    ]);
    mockUsePreferences.mockReturnValue(preferences());
  });

  it("queries tasks scheduled for today by default", () => {
    render(<TodayScreen />);

    expect(mockUseTasks).toHaveBeenCalledWith({
      filters: taskFiltersForDate(Temporal.Now.plainDateISO()),
    });
  });

  // Temporal.PlainDate keeps its data in internal slots, so compare by ISO
  // string rather than passing an instance to toHaveBeenCalledWith.
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

  it("shows an empty state when there are no tasks for the day", () => {
    const screen = render(<TodayScreen />);

    expect(screen.getByText("No tasks scheduled for this day.")).toBeTruthy();
  });

  it("defaults to the Tasks view", () => {
    const screen = render(<TodayScreen />);

    // The switcher is now an icon-only button, so the default view is asserted
    // via the Tasks content (its empty state), not a label.
    expect(screen.getByText("No tasks scheduled for this day.")).toBeTruthy();
  });

  it("renders the Journal view when Journal is selected", () => {
    const screen = render(<TodayScreen />);

    fireEvent.press(screen.getByLabelText("view-journal"));

    expect(screen.getByText("journal-view")).toBeTruthy();
    expect(screen.queryByText("No tasks scheduled for this day.")).toBeNull();
  });

  it("falls back to Tasks when Journal is selected but disabled", () => {
    mockUsePreferences.mockReturnValue(preferences({ enableJournal: false }));
    const screen = render(<TodayScreen />);

    fireEvent.press(screen.getByLabelText("view-journal"));

    expect(screen.queryByText("journal-view")).toBeNull();
    expect(screen.getByText("No tasks scheduled for this day.")).toBeTruthy();
  });

  it("does not show the empty state while the day's tasks are still loading", () => {
    mockUseTasks.mockReturnValue([
      [],
      {
        createTask: jest.fn(),
        deleteTask: jest.fn(),
        isLoading: true,
        updateTask: jest.fn(),
        updateTasks: jest.fn(),
      },
    ]);

    const screen = render(<TodayScreen />);

    expect(screen.queryByText("No tasks scheduled for this day.")).toBeNull();
  });

  it("renders a card for every task returned for the day", () => {
    mockUseTasks.mockReturnValue([
      [task],
      {
        createTask: jest.fn(),
        deleteTask: jest.fn(),
        isLoading: false,
        updateTask: jest.fn(),
        updateTasks: jest.fn(),
      },
    ]);

    const screen = render(<TodayScreen />);

    expect(screen.getByText("Write the report")).toBeTruthy();
    expect(screen.queryByText("No tasks scheduled for this day.")).toBeNull();
  });

  it("re-queries tasks for the new date after navigating a day forward", () => {
    const screen = render(<TodayScreen />);

    fireEvent.press(screen.getByLabelText("Next day"));

    expect(mockUseTasks).toHaveBeenLastCalledWith({
      filters: taskFiltersForDate(Temporal.Now.plainDateISO().add({ days: 1 })),
    });
  });

  it("re-queries tasks for the next day after swiping left", () => {
    render(<TodayScreen />);

    act(() => {
      fireGestureHandler(getByGestureTestId("day-swipe"), [
        { translationX: -200, velocityX: -900 },
      ]);
    });

    expect(mockUseTasks).toHaveBeenLastCalledWith({
      filters: taskFiltersForDate(Temporal.Now.plainDateISO().add({ days: 1 })),
    });
  });

  it("re-queries tasks for the previous day after swiping right", () => {
    render(<TodayScreen />);

    act(() => {
      fireGestureHandler(getByGestureTestId("day-swipe"), [
        { translationX: 200, velocityX: 900 },
      ]);
    });

    expect(mockUseTasks).toHaveBeenLastCalledWith({
      filters: taskFiltersForDate(
        Temporal.Now.plainDateISO().subtract({ days: 1 }),
      ),
    });
  });

  it("advances two days when two swipes fire before a re-render settles", () => {
    render(<TodayScreen />);

    act(() => {
      fireGestureHandler(getByGestureTestId("day-swipe"), [
        { translationX: -200, velocityX: -900 },
      ]);
      fireGestureHandler(getByGestureTestId("day-swipe"), [
        { translationX: -200, velocityX: -900 },
      ]);
    });

    expect(mockUseTasks).toHaveBeenLastCalledWith({
      filters: taskFiltersForDate(Temporal.Now.plainDateISO().add({ days: 2 })),
    });
  });
});
