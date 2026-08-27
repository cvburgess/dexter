import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Text, TextInput as RNTextInput, TouchableOpacity } from "react-native";

import { TSearchResult } from "@/api/search";
import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import SearchScreen from "@/app/(app)/(tabs)/search";
import { useSearch } from "@/hooks/useSearch";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";

// `requireActual` keeps the real MIN_SEARCH_LENGTH — a stubbed undefined would
// pin the screen to idle. That drags in useAuth's module graph, hence the stub below.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useSearch", () => {
  const actual =
    jest.requireActual<typeof import("@/hooks/useSearch")>("@/hooks/useSearch");
  return { ...actual, useSearch: jest.fn() };
});
jest.mock("@/hooks/useTasks", () => ({ useTasks: jest.fn() }));
jest.mock("@/hooks/useTemplates", () => ({ useTemplates: jest.fn() }));
// The screen reads one field, to decide whether a journal result is tappable
// (DEX-105). Unmocked it needs a query client this file doesn't build.
const mockEnableJournal = { value: true };
jest.mock("@/hooks/usePreferences", () => ({
  usePreferences: () => [
    {
      enableJournal: mockEnableJournal.value,
      // A prompt in each ritual, so a journal hit has a step to open in
      // whichever one the link names (DEX-151).
      templatePrompts: [
        { id: "a", prompt: "Highlight", period: "am" },
        { id: "b", prompt: "What went well?", period: "pm" },
      ],
    },
    {},
  ],
}));
// Both halves of this screen's safe-area handling are stubbed — the context
// insets and the screens SafeAreaView framing it; see the DEX-107 test below.
jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);
jest.mock("react-native-screens/experimental", () =>
  require("@/testUtils/mockSafeAreaEdges").mockScreensSafeArea(),
);

// Native `SearchField` renders null (it's `Stack.SearchBar`); stub a plain
// input with the same label so this suite can drive the query.
const mockSearchField = ({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) => (
  <RNTextInput
    accessibilityLabel="Search"
    placeholder={placeholder}
    value={value}
    onChangeText={onChangeText}
  />
);
jest.mock("@/components/SearchField", () => ({
  SearchField: (props: Parameters<typeof mockSearchField>[0]) =>
    mockSearchField(props),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

// TaskCard mounts native menu hosts a unit test can't drive; stub to a marker
// with onPress (DEX-47) and onDelete so template cleanup can be asserted.
const mockTaskCard = ({
  task,
  onPress,
  onDelete,
}: {
  task: TTask;
  onPress?: () => void;
  onDelete: () => void;
}) => (
  <>
    <TouchableOpacity
      accessibilityLabel={`open-${task.title}`}
      onPress={onPress}
    >
      <Text>task-card:{task.title}</Text>
    </TouchableOpacity>
    <TouchableOpacity
      accessibilityLabel={`delete-${task.title}`}
      onPress={onDelete}
    >
      <Text>delete</Text>
    </TouchableOpacity>
  </>
);
jest.mock("@/components/TaskCard", () => ({
  TaskCard: (props: Parameters<typeof mockTaskCard>[0]) => mockTaskCard(props),
}));

const mockUseSearch = useSearch as jest.MockedFunction<typeof useSearch>;
const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockUseTemplates = useTemplates as jest.MockedFunction<
  typeof useTemplates
>;
const mockDeleteTask = jest.fn();
const mockDeleteTemplate = jest.fn();

// Types then lets the debounce elapse, so the query reaches useSearch rather
// than staying at its pre-debounce value.
const typeSearch = (text: string) => {
  fireEvent.changeText(screen.getByLabelText("Search"), text);
  act(() => jest.advanceTimersByTime(500));
};

const searchResult = (
  results: TSearchResult[] = [],
  overrides: {
    isLoading?: boolean;
    enabled?: boolean;
    matchedQuery?: string;
  } = {},
): ReturnType<typeof useSearch> =>
  [
    results,
    {
      isLoading: false,
      enabled: true,
      // What the rows on screen actually matched — the excerpts highlight
      // against this rather than the live query.
      matchedQuery: "milk",
      ...overrides,
    },
  ] as ReturnType<typeof useSearch>;

const task = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.UNPRIORITIZED,
  scheduledFor: "2026-07-14",
  status: ETaskStatus.TODO,
  subtasks: [],
  templateId: null,
  title: "Buy milk",
  url: null,
  ...overrides,
});

const journalResult = {
  kind: "journal",
  date: "2026-07-12",
  prompt: "What went well?",
  content: "remembered the milk",
} as const;

describe("SearchScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The screen debounces the query before searching, so every test that types
    // has to drive the clock.
    jest.useFakeTimers();
    mockEnableJournal.value = true;
    mockUseTasks.mockReturnValue([[], { deleteTask: mockDeleteTask }] as never);
    mockUseTemplates.mockReturnValue([
      [],
      { deleteTemplate: mockDeleteTemplate },
    ] as never);
    mockUseSearch.mockReturnValue(searchResult());
  });

  afterEach(() => jest.useRealTimers());

  it("shows the idle prompt before a query is long enough to search", () => {
    mockUseSearch.mockReturnValue(searchResult([], { enabled: false }));

    render(<SearchScreen />);

    expect(
      screen.getByText("Search your tasks, notes, and journal."),
    ).toBeTruthy();
  });

  it("keeps the results list mounted while idle (DEX-136)", () => {
    // Not cosmetic: UIKit resolves this tab's scroll view once at mount, always
    // on the idle state — a list appearing only with results breaks tab-bar minimize.
    mockUseSearch.mockReturnValue(searchResult([], { enabled: false }));

    render(<SearchScreen />);

    expect(screen.getByTestId("search-results")).toBeTruthy();
  });

  it("passes what the user types to the search hook", () => {
    render(<SearchScreen />);

    typeSearch("milk");

    expect(mockUseSearch).toHaveBeenLastCalledWith("milk");
  });

  it("debounces, so a burst of typing is one search rather than one per key", () => {
    render(<SearchScreen />);
    const field = screen.getByLabelText("Search");

    // Every search is a full scan of the account's tasks, notes, and journals,
    // so this is about round trips, not render cost.
    for (const text of ["m", "mi", "mil", "milk"]) {
      fireEvent.changeText(field, text);
      act(() => jest.advanceTimersByTime(50));
    }
    // Nothing but the initial empty query has reached the hook yet.
    expect(mockUseSearch).not.toHaveBeenCalledWith("mil");

    act(() => jest.advanceTimersByTime(500));

    expect(mockUseSearch).toHaveBeenLastCalledWith("milk");
    expect(mockUseSearch).not.toHaveBeenCalledWith("mi");
  });

  it("does not fall back to the idle prompt during the debounce window", () => {
    // `enabled` lags the field by up to one debounce; gating idle on it told a
    // user who'd just typed two characters that they hadn't typed anything.
    mockUseSearch.mockReturnValue(searchResult([], { enabled: false }));
    render(<SearchScreen />);

    // Typed, but the debounce hasn't fired — the field is searchable while the
    // hook is still keyed on "".
    fireEvent.changeText(screen.getByLabelText("Search"), "milk");

    expect(
      screen.queryByText("Search your tasks, notes, and journal."),
    ).toBeNull();
  });

  it("returns to the idle prompt when the field is cleared", () => {
    mockUseSearch.mockReturnValue(searchResult([], { enabled: false }));
    render(<SearchScreen />);

    typeSearch("");

    expect(
      screen.getByText("Search your tasks, notes, and journal."),
    ).toBeTruthy();
  });

  it("reports when a searched query matched nothing", () => {
    render(<SearchScreen />);
    typeSearch("milk");

    // Distinct from the prompt state above: this one ran and came back empty.
    expect(screen.getByText("No matches.")).toBeTruthy();
  });

  it("groups results under a heading per kind", () => {
    mockUseSearch.mockReturnValue(
      searchResult([
        { kind: "task", task: task() },
        { kind: "note", date: "2026-07-13", content: "bought the milk" },
        {
          kind: "journal",
          date: "2026-07-12",
          prompt: "What went well?",
          content: "remembered the milk",
        },
      ]),
    );

    render(<SearchScreen />);
    typeSearch("milk");

    expect(screen.getByText("Tasks")).toBeTruthy();
    expect(screen.getByText("Notes")).toBeTruthy();
    expect(screen.getByText("Journal")).toBeTruthy();
    expect(screen.getByText("task-card:Buy milk")).toBeTruthy();
    // The journal prompt is shown alongside the excerpt, so the result says
    // which question it answered.
    expect(screen.getByText("What went well?")).toBeTruthy();
  });

  it("omits the heading for a kind with no results", () => {
    mockUseSearch.mockReturnValue(
      searchResult([{ kind: "task", task: task() }]),
    );

    render(<SearchScreen />);
    typeSearch("milk");

    expect(screen.getByText("Tasks")).toBeTruthy();
    expect(screen.queryByText("Notes")).toBeNull();
    expect(screen.queryByText("Journal")).toBeNull();
  });

  it("removes a repeating task's schedule when the task is deleted", () => {
    mockUseSearch.mockReturnValue(
      searchResult([
        { kind: "task", task: task({ templateId: "template-1" }) },
      ]),
    );
    render(<SearchScreen />);
    typeSearch("milk");

    fireEvent.press(screen.getByLabelText("delete-Buy milk"));

    // The task→template FK is ON DELETE SET NULL, so without this the schedule
    // survives and keeps creating occurrences of a deleted task (DEX-21).
    expect(mockDeleteTemplate).toHaveBeenCalledWith("template-1");
    expect(mockDeleteTask).toHaveBeenCalledWith("task-1");
  });

  it("does not touch templates when deleting a one-off task", () => {
    mockUseSearch.mockReturnValue(
      searchResult([{ kind: "task", task: task({ templateId: null }) }]),
    );
    render(<SearchScreen />);
    typeSearch("milk");

    fireEvent.press(screen.getByLabelText("delete-Buy milk"));

    expect(mockDeleteTemplate).not.toHaveBeenCalled();
    expect(mockDeleteTask).toHaveBeenCalledWith("task-1");
  });

  it("opens a scheduled task result on its day", () => {
    mockUseSearch.mockReturnValue(
      searchResult([
        { kind: "task", task: task({ scheduledFor: "2026-07-14" }) },
      ]),
    );
    render(<SearchScreen />);
    typeSearch("milk");

    fireEvent.press(screen.getByLabelText("open-Buy milk"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/today",
      params: { date: "2026-07-14", mode: "tasks", n: "1" },
    });
  });

  it("opens an unscheduled task result in the backlog, carrying the query", () => {
    mockUseSearch.mockReturnValue(
      searchResult([{ kind: "task", task: task({ scheduledFor: null }) }]),
    );
    render(<SearchScreen />);
    typeSearch("milk");

    fireEvent.press(screen.getByLabelText("open-Buy milk"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/today",
      params: { mode: "backlog", q: "milk", n: "1" },
    });
  });

  it("does not link a completed, unscheduled task result", () => {
    mockUseSearch.mockReturnValue(
      searchResult([
        {
          kind: "task",
          task: task({ scheduledFor: null, status: ETaskStatus.DONE }),
        },
      ]),
    );
    render(<SearchScreen />);
    typeSearch("milk");

    // Nowhere to open: the backlog shows only incomplete tasks. The card still
    // renders — its status button is how the task gets reopened.
    fireEvent.press(screen.getByLabelText("open-Buy milk"));

    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByText("task-card:Buy milk")).toBeTruthy();
  });

  it("opens a note result on its day's notes view", () => {
    mockUseSearch.mockReturnValue(
      searchResult([
        { kind: "note", date: "2026-07-13", content: "bought the milk" },
      ]),
    );
    render(<SearchScreen />);
    typeSearch("milk");

    fireEvent.press(screen.getByLabelText("Jul 13, 2026"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/today",
      params: { date: "2026-07-13", mode: "notes", n: "1" },
    });
  });

  // The journal moved to the Ritual tab (DEX-105) — the one result opening a
  // tab other than Today. The link also names the ritual (DEX-151).
  it("opens a journal result on its day's ritual journal step", () => {
    mockUseSearch.mockReturnValue(searchResult([journalResult]));
    render(<SearchScreen />);
    typeSearch("milk");

    fireEvent.press(screen.getByLabelText("What went well?, Jul 12, 2026"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/ritual",
      params: { date: "2026-07-12", mode: "pm", step: "journal", n: "1" },
    });
  });

  it("does not link a journal result when the journal is disabled", () => {
    // There is no ritual journal step to land on, so the card stays readable
    // but isn't a link — the same treatment a completed unscheduled task gets.
    mockEnableJournal.value = false;
    mockUseSearch.mockReturnValue(searchResult([journalResult]));
    render(<SearchScreen />);
    typeSearch("milk");

    fireEvent.press(screen.getByLabelText("What went well?, Jul 12, 2026"));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("frames itself from the screen's safe area, not the tab's (DEX-107)", () => {
    render(<SearchScreen />);

    // Jest can't measure an inset, but it can pin which provider the top edge
    // comes from — the stack screen's own view, not the per-tab SafeAreaProvider.
    expect(
      screen.getByTestId("screen-safe-area-edges-left,right,top"),
    ).toBeTruthy();
    // Never `bottom`: the list scrolls under the tab bar and reserves that inset
    // in its own content (DEX-91).
    expect(screen.queryByTestId(/screen-safe-area-edges-.*bottom/)).toBeNull();
  });
});
