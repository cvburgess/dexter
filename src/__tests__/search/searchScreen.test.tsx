import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text, TouchableOpacity } from "react-native";

import { TSearchResult } from "@/api/search";
import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import SearchScreen from "@/app/(app)/(tabs)/search";
import { useSearch } from "@/hooks/useSearch";
import { useTasks } from "@/hooks/useTasks";

// `requireActual` below pulls in useSearch's real module graph, which reaches
// useAuth → expo-linking → the expo-constants manifest this unit test doesn't
// set up. Same stub the useSearch suite uses.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useSearch", () => {
  const actual =
    jest.requireActual<typeof import("@/hooks/useSearch")>("@/hooks/useSearch");
  // Keep the real MIN_SEARCH_LENGTH — the screen prints it in its prompt, so a
  // stubbed value would let the copy and the hook's floor drift apart.
  return { ...actual, useSearch: jest.fn() };
});
jest.mock("@/hooks/useTasks", () => ({ useTasks: jest.fn() }));
jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

// TaskCard mounts several native `@expo/ui` menu hosts that a unit test can't
// drive. Stub it to a marker exposing the title plus a button wired to
// `onPress`, which is the prop this screen adds (DEX-47) — the card's own
// behavior is covered by TaskCard.test.
const mockTaskCard = ({
  task,
  onPress,
}: {
  task: TTask;
  onPress?: () => void;
}) => (
  <TouchableOpacity accessibilityLabel={`open-${task.title}`} onPress={onPress}>
    <Text>task-card:{task.title}</Text>
  </TouchableOpacity>
);
jest.mock("@/components/TaskCard", () => ({
  TaskCard: (props: Parameters<typeof mockTaskCard>[0]) => mockTaskCard(props),
}));

const mockUseSearch = useSearch as jest.MockedFunction<typeof useSearch>;
const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;

const searchResult = (
  results: TSearchResult[] = [],
  overrides: { isLoading?: boolean; enabled?: boolean } = {},
): ReturnType<typeof useSearch> =>
  [results, { isLoading: false, enabled: true, ...overrides }] as ReturnType<
    typeof useSearch
  >;

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
    mockUseTasks.mockReturnValue([[], {}] as never);
    mockUseSearch.mockReturnValue(searchResult());
  });

  it("prompts for a longer query before searching anything", () => {
    mockUseSearch.mockReturnValue(searchResult([], { enabled: false }));

    render(<SearchScreen />);

    expect(screen.getByText(/Type at least 2 characters/)).toBeTruthy();
  });

  it("passes what the user types to the search hook", () => {
    render(<SearchScreen />);

    fireEvent.changeText(screen.getByLabelText("Search"), "milk");

    expect(mockUseSearch).toHaveBeenLastCalledWith("milk");
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

  it("opens a scheduled task result on its day", () => {
    mockUseSearch.mockReturnValue(
      searchResult([
        { kind: "task", task: task({ scheduledFor: "2026-07-14" }) },
      ]),
    );
    render(<SearchScreen />);
    fireEvent.changeText(screen.getByLabelText("Search"), "milk");

    fireEvent.press(screen.getByLabelText("open-Buy milk"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/today",
      params: { date: "2026-07-14", mode: "tasks" },
    });
  });

  it("opens an unscheduled task result in the backlog, carrying the query", () => {
    mockUseSearch.mockReturnValue(
      searchResult([{ kind: "task", task: task({ scheduledFor: null }) }]),
    );
    render(<SearchScreen />);
    fireEvent.changeText(screen.getByLabelText("Search"), "milk");

    fireEvent.press(screen.getByLabelText("open-Buy milk"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/today",
      params: { mode: "backlog", q: "milk" },
    });
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
      params: { date: "2026-07-13", mode: "notes" },
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
      params: { date: "2026-07-12", mode: "journal" },
    });
  });
});
