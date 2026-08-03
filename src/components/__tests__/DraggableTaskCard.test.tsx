import { act, render } from "@testing-library/react-native";
import type { ComponentProps, ReactNode } from "react";
import { Text } from "react-native";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import type { TaskCard } from "@/components/TaskCard";
import { useTasks } from "@/hooks/useTasks";

import { DragScheduleProvider } from "../DragScheduleProvider";
import { DraggableTaskCard } from "../DraggableTaskCard";

// useTasks imports the supabase client from useAuth, which reads the app's URI
// scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useTasks", () => ({ useTasks: jest.fn() }));

// TaskCard wraps a native menu host that can't be driven from a unit test (see
// TaskDrawer.test); render its title and capture the props this wrapper passes
// down, so the editing gate can be driven directly.
const mockTaskCard = jest.fn((props: ComponentProps<typeof TaskCard>) => (
  <Text>{props.task.title}</Text>
));
jest.mock("@/components/TaskCard", () => ({
  TaskCard: (props: ComponentProps<typeof TaskCard>) => mockTaskCard(props),
}));

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;

const task: TTask = {
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
};

const cardProps = {
  task,
  onUpdate: jest.fn(),
  onDuplicate: jest.fn(),
  onDelete: jest.fn(),
  onPromoteSubtask: jest.fn(),
};

const withProvider = (children: ReactNode) => (
  <DragScheduleProvider>{children}</DragScheduleProvider>
);

/** The props the drax stub received for the drag source. */
const dragProps = (screen: ReturnType<typeof render>) =>
  screen.getByTestId(`task-drag-${task.id}`).props as {
    draggable: boolean;
    receptive: boolean;
    payload: unknown;
    longPressDelay: number;
    renderHoverContent: (arg: {
      dimensions?: { width: number };
    }) => React.ReactElement;
  };

/** Drives TaskCard's editing callback, which is how the wrapper learns a field is focused. */
const setEditing = (editing: boolean) => {
  const last = mockTaskCard.mock.calls.at(-1)?.[0];
  act(() => last?.onEditingChange?.(editing));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTasks.mockReturnValue([
    [task],
    {
      createTask: jest.fn(),
      deleteTask: jest.fn(),
      isError: false,
      isLoading: false,
      refetch: jest.fn(),
      updateTask: jest.fn(),
      updateTasks: jest.fn(),
    },
  ]);
});

describe("DraggableTaskCard", () => {
  // The small-screen layouts, the backlog sheet, and Search all render this
  // without a provider. A DraxView mounted there would throw.
  it("is an ordinary card outside a provider", () => {
    const screen = render(<DraggableTaskCard {...cardProps} />);

    expect(screen.getByText("Write report")).toBeTruthy();
    expect(screen.queryByTestId(`task-drag-${task.id}`)).toBeNull();
  });

  it("becomes a drag source inside a provider", () => {
    const screen = render(withProvider(<DraggableTaskCard {...cardProps} />));

    expect(screen.getByTestId(`task-drag-${task.id}`)).toBeTruthy();
  });

  // An id, not the task: drax caches a view's props when it registers, so a
  // whole-task payload would freeze at whatever the task was then.
  it("carries only the task's id as its payload", () => {
    const screen = render(withProvider(<DraggableTaskCard {...cardProps} />));

    expect(dragProps(screen).payload).toEqual({ taskId: "task-1" });
  });

  it("never receives a drop itself", () => {
    const screen = render(withProvider(<DraggableTaskCard {...cardProps} />));

    expect(dragProps(screen).receptive).toBe(false);
  });

  // Drax's default hover would re-render this card's children into the overlay,
  // mounting a second set of native menu hosts that paint nothing on device.
  it("previews with a static shell rather than the card itself", () => {
    const screen = render(withProvider(<DraggableTaskCard {...cardProps} />));

    const preview = render(
      dragProps(screen).renderHoverContent({ dimensions: { width: 240 } }),
    );

    expect(preview.getByTestId(`task-card-preview-${task.id}`)).toBeTruthy();
  });

  describe("while a field on the card is being edited", () => {
    // Web activates the drag with no hold at all (see `dragActivation`), so
    // without this, dragging across a title to select the text would pick the
    // card up instead. Same fix as SwipeableDay's `enabled={!editing}`.
    it("suspends the drag", () => {
      const screen = render(withProvider(<DraggableTaskCard {...cardProps} />));
      expect(dragProps(screen).draggable).toBe(true);

      setEditing(true);

      expect(dragProps(screen).draggable).toBe(false);
    });

    it("restores it once editing ends", () => {
      const screen = render(withProvider(<DraggableTaskCard {...cardProps} />));
      setEditing(true);

      setEditing(false);

      expect(dragProps(screen).draggable).toBe(true);
    });
  });
});
