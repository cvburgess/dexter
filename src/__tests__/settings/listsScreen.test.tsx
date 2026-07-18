import { fireEvent, render } from "@testing-library/react-native";

import { TList } from "@/api/lists";
import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import ListsScreen from "@/app/(app)/(tabs)/settings/lists";
import { useIsMultiPane } from "@/hooks/useIsMultiPane";
import { useLists } from "@/hooks/useLists";
import { useTasks } from "@/hooks/useTasks";

jest.mock("@/hooks/useLists", () => ({ useLists: jest.fn() }));
jest.mock("@/hooks/useTasks", () => ({ useTasks: jest.fn() }));
jest.mock("@/hooks/useIsMultiPane", () => ({ useIsMultiPane: jest.fn() }));

jest.mock("react-native-safe-area-context", () =>
  require("@/testUtils/mockSafeAreaEdges").mockSafeAreaContext(),
);

const mockSetOptions = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useNavigation: () => ({ setOptions: mockSetOptions }),
  useRouter: () => ({ push: mockPush }),
}));

const mockUseLists = useLists as jest.MockedFunction<typeof useLists>;
const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockUseIsMultiPane = useIsMultiPane as jest.MockedFunction<
  typeof useIsMultiPane
>;

const makeList = (overrides: Partial<TList> = {}): TList => ({
  id: "list-1",
  title: "Work",
  emoji: "💼",
  isArchived: false,
  createdAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const makeTask = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  title: "A task",
  dueOn: null,
  goalId: null,
  listId: "list-1",
  priority: ETaskPriority.UNPRIORITIZED,
  scheduledFor: null,
  status: ETaskStatus.TODO,
  templateId: null,
  ...overrides,
});

const renderWith = ({
  lists = [],
  tasks = [],
}: { lists?: TList[]; tasks?: TTask[] } = {}) => {
  mockUseLists.mockReturnValue([lists, {} as never]);
  mockUseTasks.mockReturnValue([tasks, {} as never]);
  return render(<ListsScreen />);
};

// The "+" add button lives in the navigation header (set via setOptions), so
// render the latest headerRight to inspect/press it.
const renderHeader = () => {
  const options = mockSetOptions.mock.calls.at(-1)?.[0];
  return render(options.headerRight());
};

describe("ListsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsMultiPane.mockReturnValue(false);
  });

  it("skips the left safe-area edge in two-pane mode (sidebar owns it)", () => {
    mockUseIsMultiPane.mockReturnValue(true);
    const screen = renderWith();

    expect(screen.getByTestId("safe-area-edges-bottom,right")).toBeTruthy();
  });

  it("includes the left safe-area edge in single-column mode", () => {
    mockUseIsMultiPane.mockReturnValue(false);
    const screen = renderWith();

    expect(
      screen.getByTestId("safe-area-edges-bottom,left,right"),
    ).toBeTruthy();
  });

  it("shows the empty state when there are no lists", () => {
    const screen = renderWith({ lists: [] });

    expect(screen.getByText("Tap ＋ to create your first list.")).toBeTruthy();
  });

  it("renders a row per list", () => {
    const screen = renderWith({
      lists: [
        makeList({ id: "list-1", title: "Work" }),
        makeList({ id: "list-2", title: "Home" }),
      ],
    });

    expect(screen.getByText("Work")).toBeTruthy();
    expect(screen.getByText("Home")).toBeTruthy();
  });

  it("shows the open-task count in the subtitle, ignoring completed tasks", () => {
    const screen = renderWith({
      lists: [makeList({ id: "list-1", title: "Work" })],
      tasks: [
        makeTask({ id: "t1", listId: "list-1", status: ETaskStatus.TODO }),
        makeTask({
          id: "t2",
          listId: "list-1",
          status: ETaskStatus.IN_PROGRESS,
        }),
        makeTask({ id: "t3", listId: "list-1", status: ETaskStatus.DONE }),
        makeTask({ id: "t4", listId: "other", status: ETaskStatus.TODO }),
      ],
    });

    expect(screen.getByText("2 open")).toBeTruthy();
  });

  it("always shows the header add button", () => {
    renderWith();

    expect(renderHeader().getByLabelText("New list")).toBeTruthy();
  });

  it("opens the new-list modal when the add button is pressed", () => {
    renderWith();

    fireEvent.press(renderHeader().getByLabelText("New list"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/settings/lists/[id]",
      params: { id: "new" },
    });
  });

  it("opens the edit modal when a list row is tapped", () => {
    const screen = renderWith({
      lists: [makeList({ id: "list-1", title: "Work" })],
    });

    fireEvent.press(screen.getByLabelText("Edit Work"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/settings/lists/[id]",
      params: { id: "list-1" },
    });
  });
});
