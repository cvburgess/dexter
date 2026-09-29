import { fireEvent, render } from "@testing-library/react-native";
import type { ComponentProps } from "react";
import { Text } from "react-native";

import { TList } from "@/api/lists";
import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import type { ListColumn } from "@/components/ListColumn";
import { useLists } from "@/hooks/useLists";
import { useTasks } from "@/hooks/useTasks";

import { ListsView } from "../ListsView";

// useTasks imports the supabase client from useAuth, which reads the app's URI
// scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useTasks", () => ({ useTasks: jest.fn() }));
jest.mock("@/hooks/useLists", () => ({ useLists: jest.fn() }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

// Typed off the real component so a prop rename fails here.
const mockListColumn = ({ column }: ComponentProps<typeof ListColumn>) => (
  <Text>{`column:${column.title}`}</Text>
);
jest.mock("@/components/ListColumn", () => ({
  ListColumn: (props: ComponentProps<typeof ListColumn>) =>
    mockListColumn(props),
}));

const mockUpdateTask = jest.fn();
const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockUseLists = useLists as jest.MockedFunction<typeof useLists>;

const task = (overrides: Partial<TTask> = {}): TTask => ({
  id: "task-1",
  alarmTime: null,
  dueOn: null,
  goalId: null,
  listId: null,
  priority: ETaskPriority.UNPRIORITIZED,
  scheduledFor: null,
  status: ETaskStatus.TODO,
  subtasks: [],
  templateId: null,
  title: "Write report",
  url: null,
  ...overrides,
});

const list = (id: string): TList => ({
  id,
  emoji: "📋",
  title: id,
  isArchived: false,
  createdAt: "2026-01-01T00:00:00Z",
});

const mockData = (tasks: TTask[], lists: TList[]) => {
  mockUseTasks.mockReturnValue([
    tasks,
    {
      createTask: jest.fn(),
      deleteTask: jest.fn(),
      isError: false,
      isLoading: false,
      refetch: jest.fn(),
      updateTask: mockUpdateTask,
      updateTasks: jest.fn(),
    },
  ]);
  mockUseLists.mockReturnValue([lists, { isLoading: false }] as never);
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ListsView", () => {
  it("drops a card onto another list's column to reassign it", () => {
    mockData([task({ listId: "work" })], [list("work"), list("home")]);
    const screen = render(<ListsView />);

    const home = screen.getByTestId("list-drop-home").props as {
      onReceiveDragDrop: (event: { dragged: { payload?: unknown } }) => void;
    };
    home.onReceiveDragDrop({ dragged: { payload: { taskId: "task-1" } } });

    expect(mockUpdateTask).toHaveBeenCalledWith({
      id: "task-1",
      listId: "home",
    });
  });

  it("offers a No List target only while some open task has no list", () => {
    mockData([task({ listId: null })], [list("work")]);
    const screen = render(<ListsView />);
    expect(screen.getByTestId("list-drop-none")).toBeTruthy();

    mockData([task({ listId: "work" })], [list("work")]);
    screen.rerender(<ListsView />);
    expect(screen.queryByTestId("list-drop-none")).toBeNull();
  });

  it("invites creating a first list instead of rendering an empty board", () => {
    mockData([task()], []);
    const screen = render(<ListsView />);

    expect(screen.queryByTestId("list-drop-none")).toBeNull();
    fireEvent.press(screen.getByText("Create a list"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/settings/lists/[id]",
      params: { id: "new" },
    });
  });
});
