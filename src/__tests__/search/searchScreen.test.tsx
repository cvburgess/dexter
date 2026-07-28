import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Text, TextInput as RNTextInput, TouchableOpacity } from "react-native";

import { TSearchResult } from "@/api/search";
import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import SearchScreen from "@/app/(app)/(tabs)/search";
import { useSearch } from "@/hooks/useSearch";
import { useTasks } from "@/hooks/useTasks";
import { useTemplates } from "@/hooks/useTemplates";

// A plain stub: the screen only uses `useSearch` from this module now, so there
// is nothing to preserve with `requireActual` — which also means this suite no
// longer has to stub `useAuth` to keep the real module graph (and its
// expo-constants manifest requirement) out of the way.
jest.mock("@/hooks/useSearch", () => ({ useSearch: jest.fn() }));
jest.mock("@/hooks/useTasks", () => ({ useTasks: jest.fn() }));
jest.mock("@/hooks/useTemplates", () => ({ useTemplates: jest.fn() }));
jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

// On native `SearchField` is `Stack.SearchBar`, which renders `null` and hangs
// itself off the screen's navigation options — there's no element for a test to
// type into. Stub it with a plain input carrying the same accessibility label so
// this suite can drive the query; the real component's two halves are covered by
// SearchField.web.test.tsx and, on native, only by the device.
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

// TaskCard mounts several native `@expo/ui` menu hosts that a unit test can't
// drive. Stub it to a marker exposing the title plus two buttons — one wired to
// `onPress` (the prop this screen adds, DEX-47) and one to `onDelete`, so the
// repeat-template cleanup can be asserted. The card's own behavior is covered by
// TaskCard.test.
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

/**
 * Types into the field and lets the screen's debounce elapse, so the query
 * actually reaches `useSearch` (and `searchedQuery`, which the backlog link
 * carries) rather than staying at its pre-debounce value.
 */
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
  ...overrides,
});

describe("SearchScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The screen debounces the query before searching, so every test that types
    // has to drive the clock.
    jest.useFakeTimers();
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

  it("reports when a searched query matched nothing", () => {
    render(<SearchScreen />);

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

    // It has nowhere to open: the backlog shows only incomplete tasks, so a
    // link would land on an empty drawer. The card is still rendered — its
    // status button is how the task gets reopened from here.
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

    fireEvent.press(screen.getByLabelText("Jul 13, 2026"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/today",
      params: { date: "2026-07-13", mode: "notes", n: "1" },
    });
  });

  it("opens a journal result on its day's journal view", () => {
    mockUseSearch.mockReturnValue(
      searchResult([
        {
          kind: "journal",
          date: "2026-07-12",
          prompt: "What went well?",
          content: "remembered the milk",
        },
      ]),
    );
    render(<SearchScreen />);

    fireEvent.press(screen.getByLabelText("What went well?, Jul 12, 2026"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/today",
      params: { date: "2026-07-12", mode: "journal", n: "1" },
    });
  });
});
