import { render } from "@testing-library/react-native";
import { Text } from "react-native";

import { ETaskPriority, ETaskStatus, TTask } from "@/api/tasks";
import { useTasks } from "@/hooks/useTasks";

import { DragScheduleProvider } from "../DragScheduleProvider";
import { TaskDropTarget } from "../TaskDropTarget";

// useTasks imports the supabase client from useAuth, which reads the app's URI
// scheme at module scope — not available under Jest.
jest.mock("@/hooks/useAuth", () => ({ supabase: {} }));
jest.mock("@/hooks/useTasks", () => ({ useTasks: jest.fn() }));

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;
const mockUpdateTask = jest.fn();

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

const mockTasks = (tasks: TTask[]) => {
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
};

/**
 * The props the drax stub passed to the drop target. Drax itself calls these
 * off its own registry rather than off the rendered element, which is why the
 * tests below invoke them directly instead of simulating a pointer path.
 */
const targetProps = (screen: ReturnType<typeof render>, testID: string) =>
  screen.getByTestId(testID).props as {
    acceptsDrag: (payload: unknown) => boolean;
    onReceiveDragDrop: (event: { dragged: { payload?: unknown } }) => void;
  };

const renderTarget = (scheduledFor: string | null) =>
  render(
    <DragScheduleProvider>
      <TaskDropTarget scheduledFor={scheduledFor} testID="target">
        <Text>Thursday</Text>
      </TaskDropTarget>
    </DragScheduleProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockTasks([task()]);
});

describe("TaskDropTarget", () => {
  it("renders its children as a plain view outside a provider", () => {
    const screen = render(
      <TaskDropTarget scheduledFor="2026-07-16">
        <Text>Thursday</Text>
      </TaskDropTarget>,
    );

    expect(screen.getByText("Thursday")).toBeTruthy();
  });

  it("schedules a dropped task for its own date", () => {
    const screen = renderTarget("2026-07-16");

    targetProps(screen, "target").onReceiveDragDrop({
      dragged: { payload: { taskId: "task-1" } },
    });

    expect(mockUpdateTask).toHaveBeenCalledWith({
      id: "task-1",
      scheduledFor: "2026-07-16",
    });
  });

  it("unschedules a task dropped on a null target, which is what the backlog pane is", () => {
    mockTasks([task({ scheduledFor: "2026-07-16" })]);
    const screen = renderTarget(null);

    targetProps(screen, "target").onReceiveDragDrop({
      dragged: { payload: { taskId: "task-1" } },
    });

    expect(mockUpdateTask).toHaveBeenCalledWith({
      id: "task-1",
      scheduledFor: null,
    });
  });

  it("ignores a payload that isn't a task", () => {
    const screen = renderTarget("2026-07-16");

    targetProps(screen, "target").onReceiveDragDrop({
      dragged: { payload: { some: "other drag" } },
    });

    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  it("ignores a task deleted while it was being dragged", () => {
    mockTasks([]);
    const screen = renderTarget("2026-07-16");

    targetProps(screen, "target").onReceiveDragDrop({
      dragged: { payload: { taskId: "task-1" } },
    });

    expect(mockUpdateTask).not.toHaveBeenCalled();
  });

  describe("acceptsDrag", () => {
    it("accepts a task scheduled for another day", () => {
      mockTasks([task({ scheduledFor: "2026-07-14" })]);
      const screen = renderTarget("2026-07-16");

      expect(
        targetProps(screen, "target").acceptsDrag({ taskId: "task-1" }),
      ).toBe(true);
    });

    it("accepts an unscheduled task onto a day", () => {
      mockTasks([task({ scheduledFor: null })]);
      const screen = renderTarget("2026-07-16");

      expect(
        targetProps(screen, "target").acceptsDrag({ taskId: "task-1" }),
      ).toBe(true);
    });

    // Rejecting rather than no-op'ing on drop is deliberate: drax consults this
    // before a view becomes the receiver, so the column never highlights either.
    it("rejects a task already scheduled for this day", () => {
      mockTasks([task({ scheduledFor: "2026-07-16" })]);
      const screen = renderTarget("2026-07-16");

      expect(
        targetProps(screen, "target").acceptsDrag({ taskId: "task-1" }),
      ).toBe(false);
    });

    it("rejects an already-unscheduled task onto the backlog", () => {
      mockTasks([task({ scheduledFor: null })]);
      const screen = renderTarget(null);

      expect(
        targetProps(screen, "target").acceptsDrag({ taskId: "task-1" }),
      ).toBe(false);
    });

    it("rejects a foreign payload", () => {
      const screen = renderTarget("2026-07-16");

      expect(targetProps(screen, "target").acceptsDrag({ nope: true })).toBe(
        false,
      );
    });
  });

  // Invisible to a normal assertion: the Jest stub is a pass-through View, so
  // capturing a handler and calling it post-rerender reproduces drax's staleness.
  describe("handlers held from an earlier render", () => {
    it("schedules for the target's current date, not the one it mounted with", () => {
      const screen = renderTarget("2026-07-16");
      const captured = targetProps(screen, "target").onReceiveDragDrop;

      screen.rerender(
        <DragScheduleProvider>
          <TaskDropTarget scheduledFor="2026-07-20" testID="target">
            <Text>Monday</Text>
          </TaskDropTarget>
        </DragScheduleProvider>,
      );
      captured({ dragged: { payload: { taskId: "task-1" } } });

      expect(mockUpdateTask).toHaveBeenCalledWith({
        id: "task-1",
        scheduledFor: "2026-07-20",
      });
    });

    it("judges the payload against the task as it is now, not as it was", () => {
      mockTasks([task({ scheduledFor: "2026-07-16" })]);
      const screen = renderTarget("2026-07-16");
      const captured = targetProps(screen, "target").acceptsDrag;
      expect(captured({ taskId: "task-1" })).toBe(false);

      // The task moved off this day while the card stayed mounted, so it is a
      // valid drop here again.
      mockTasks([task({ scheduledFor: "2026-07-14" })]);
      screen.rerender(
        <DragScheduleProvider>
          <TaskDropTarget scheduledFor="2026-07-16" testID="target">
            <Text>Thursday</Text>
          </TaskDropTarget>
        </DragScheduleProvider>,
      );

      expect(captured({ taskId: "task-1" })).toBe(true);
    });
  });
});
